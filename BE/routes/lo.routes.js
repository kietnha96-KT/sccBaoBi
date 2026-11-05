const express = require('express');
const pool = require('../db');
const AppError = require('../utils/AppError');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { buildOrderBy } = require('../utils/sort');
const { LO_DA_LUA_JOIN, SUM_DA_LUA_CHUAN, noiBoToText } = require('../utils/loiNoiBo');

const router = express.Router();
router.use(authenticateToken);

// whitelist cột được phép sort (chặn SQL injection qua ?sort_by=) - key khớp với FE
const LO_SORT_COLUMNS = {
  ma_vat_tu: 'l.ma_vat_tu',
  so_lo: 'l.so_lo',
  ten_ncc: 'n.ten_ncc',
  ngay_san_xuat: 'l.ngay_san_xuat',
  so_luong_lo: 'l.so_luong_lo',
  da_lua: 'da_lua',
  con_lai: 'con_lai',
};

const LO_SELECT = `
  SELECT
    l.*,
    v.ten_vat_tu,
    n.ten_ncc,
    COALESCE(dl.da_lua, 0) AS da_lua,
    COALESCE(dl.da_lua_noi_bo, '[]') AS da_lua_noi_bo,
    l.so_luong_lo - COALESCE(dl.da_lua, 0) AS con_lai
  FROM Lo l
  JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu
  LEFT JOIN NhaCungCap n ON n.ma_ncc = l.ma_ncc
  ${LO_DA_LUA_JOIN}
`;

// GET /api/lo - danh sách lô, lọc theo ma_vat_tu / so_lo, co phan trang (mac dinh 15/trang)
router.get(
  '/',
  async (req, res) => {
    const { ma_vat_tu, so_lo, thu_kho } = req.query;
    const { page, limit, offset } = getPagination(req.query);
    const conditions = [];
    const params = [];

    if (ma_vat_tu) {
      params.push(ma_vat_tu);
      conditions.push(`l.ma_vat_tu = $${params.length}`);
    }
    if (so_lo) {
      params.push(`%${so_lo}%`);
      conditions.push(`l.so_lo ILIKE $${params.length}`);
    }
    if (thu_kho) {
      params.push(thu_kho);
      conditions.push(`v.thu_kho = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM Lo l JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu ${where}`,
      params
    );
    const total = Number(countResult.rows[0].count);

    const orderBy = buildOrderBy(req.query, LO_SORT_COLUMNS, 'ORDER BY l.id DESC');
    const dataResult = await pool.query(
      `${LO_SELECT} ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: dataResult.rows, pagination: buildPaginationMeta({ page, limit, total }) });
  }
);

// GET /api/lo/export
router.get(
  '/export',
  requireStaff,
  async (req, res) => {
    const result = await pool.query(`${LO_SELECT} ORDER BY l.id DESC`);
    const rows = result.rows.map((r) => ({
      ...r,
      _noi_bo_txt: noiBoToText(r.da_lua_noi_bo),
    }));
    await sendExcel(res, {
      sheetName: 'Lo',
      fileName: 'danh_sach_lo',
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Số lô', key: 'so_lo', width: 20 },
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 15 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 30 },
        { header: 'Ngày sản xuất', key: 'ngay_san_xuat', width: 18 },
        { header: 'Nhà cung cấp', key: 'ten_ncc', width: 25 },
        { header: 'Số lượng lô', key: 'so_luong_lo', width: 15 },
        { header: 'Đã lựa (không tính lỗi nội bộ)', key: 'da_lua', width: 22 },
        { header: 'Lỗi nội bộ (chi tiết)', key: '_noi_bo_txt', width: 32 },
        { header: 'Còn lại', key: 'con_lai', width: 15 },
      ],
      rows,
    });
  }
);

// GET /api/lo/:id
router.get(
  '/:id',
  async (req, res) => {
    const result = await pool.query(`${LO_SELECT} WHERE l.id = $1`, [req.params.id]);
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy lô');
    res.json(result.rows[0]);
  }
);

// Cặp (ma_vat_tu + so_lo) không được trùng: so khớp bỏ qua hoa/thường và khoảng trắng đầu/cuối
// ("26004" = " 26004 "). Chỉ so trong CÙNG vật tư - cùng số lô ở vật tư khác là bình thường.
// excludeId: bỏ qua chính lô đang sửa. Không có UNIQUE INDEX ở DB vì dữ liệu cũ đã có sẵn các
// cặp trùng (xem CLAUDE.md) nên kiểm ở đây; ném 409 nếu đã có.
async function assertLoChuaTonTai(db, ma_vat_tu, so_lo, excludeId) {
  const params = [ma_vat_tu, so_lo];
  let loaiTru = '';
  if (excludeId) {
    params.push(excludeId);
    loaiTru = `AND id <> $${params.length}`;
  }
  const r = await db.query(
    `SELECT id FROM Lo
     WHERE ma_vat_tu = $1 AND lower(btrim(so_lo)) = lower(btrim($2)) ${loaiTru}
     LIMIT 1`,
    params
  );
  if (r.rows[0]) {
    throw new AppError(
      409,
      `Lô "${so_lo}" của vật tư ${ma_vat_tu} đã có trong danh mục (mã lô #${r.rows[0].id}), không thể tạo trùng.`
    );
  }
}

// POST /api/lo - admin tạo lô mới
router.post(
  '/',
  requireStaff,
  async (req, res) => {
    const { ngay_san_xuat, so_luong_lo, ma_ncc } = req.body;
    const ma_vat_tu = req.body.ma_vat_tu;
    const so_lo = typeof req.body.so_lo === 'string' ? req.body.so_lo.trim() : req.body.so_lo;
    if (!so_lo || !ma_vat_tu) {
      throw new AppError(400, 'Thiếu so_lo hoặc ma_vat_tu');
    }
    if (so_luong_lo !== undefined && Number(so_luong_lo) < 0) {
      throw new AppError(400, 'so_luong_lo không được âm');
    }

    const vt = await pool.query('SELECT ma_vat_tu FROM VatTu WHERE ma_vat_tu = $1', [
      ma_vat_tu,
    ]);
    if (!vt.rows[0]) throw new AppError(400, 'Mã vật tư không tồn tại');

    if (ma_ncc) {
      const ncc = await pool.query('SELECT ma_ncc FROM NhaCungCap WHERE ma_ncc = $1', [ma_ncc]);
      if (!ncc.rows[0]) throw new AppError(400, 'Mã nhà cung cấp không tồn tại');
    }

    // Kiểm trùng + INSERT trong 1 transaction, khóa theo (vật tư + số lô) để 2 người bấm tạo
    // cùng lúc không cùng lọt qua bước kiểm.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `lo|${ma_vat_tu}|${String(so_lo).toLowerCase()}`,
      ]);
      await assertLoChuaTonTai(client, ma_vat_tu, so_lo);

      const result = await client.query(
        `INSERT INTO Lo (so_lo, ma_vat_tu, ngay_san_xuat, so_luong_lo, ma_ncc)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [so_lo, ma_vat_tu, ngay_san_xuat || null, so_luong_lo ?? 0, ma_ncc || null]
      );
      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
);

// PUT /api/lo/:id - admin sửa lô
router.put(
  '/:id',
  requireStaff,
  async (req, res) => {
    const { ngay_san_xuat, so_luong_lo, ma_ncc } = req.body;
    const ma_vat_tu = req.body.ma_vat_tu;
    const so_lo = typeof req.body.so_lo === 'string' ? req.body.so_lo.trim() : req.body.so_lo;
    if (!so_lo || !ma_vat_tu) {
      throw new AppError(400, 'Thiếu so_lo hoặc ma_vat_tu');
    }
    if (so_luong_lo !== undefined && Number(so_luong_lo) < 0) {
      throw new AppError(400, 'so_luong_lo không được âm');
    }

    const vt = await pool.query('SELECT ma_vat_tu FROM VatTu WHERE ma_vat_tu = $1', [
      ma_vat_tu,
    ]);
    if (!vt.rows[0]) throw new AppError(400, 'Mã vật tư không tồn tại');

    if (ma_ncc) {
      const ncc = await pool.query('SELECT ma_ncc FROM NhaCungCap WHERE ma_ncc = $1', [ma_ncc]);
      if (!ncc.rows[0]) throw new AppError(400, 'Mã nhà cung cấp không tồn tại');
    }

    // Chỉ kiểm trùng khi ĐỔI khóa (vật tư hoặc số lô). Lô đang nằm trong 1 cặp trùng có sẵn từ
    // trước vẫn sửa được các thông tin khác (nhà cung cấp, ngày sản xuất, số lượng...).
    const hienTaiLo = await pool.query('SELECT so_lo, ma_vat_tu FROM Lo WHERE id = $1', [
      req.params.id,
    ]);
    const cu = hienTaiLo.rows[0];
    if (
      cu &&
      (cu.ma_vat_tu !== ma_vat_tu ||
        String(cu.so_lo).trim().toLowerCase() !== String(so_lo).toLowerCase())
    ) {
      await assertLoChuaTonTai(pool, ma_vat_tu, so_lo, req.params.id);
    }

    // Không cho hạ so_luong_lo xuống thấp hơn số đã lựa thực tế (tránh dữ liệu vô lý).
    // Dùng "đã lựa" CHUẨN (đã trừ lỗi nội bộ) cho khớp con số hiển thị trong danh mục lô.
    const daLuaResult = await pool.query(
      `SELECT COALESCE(${SUM_DA_LUA_CHUAN}, 0) AS da_lua
       FROM BaoCao bc
       LEFT JOIN LoaiLoi ll ON ll.id = bc.loi_chuan_id
       WHERE bc.lo_id = $1 AND bc.la_lua_lai = FALSE`,
      [req.params.id]
    );
    const daLua = Number(daLuaResult.rows[0].da_lua);
    if (so_luong_lo !== undefined && Number(so_luong_lo) < daLua) {
      throw new AppError(
        400,
        `so_luong_lo (${so_luong_lo}) không được nhỏ hơn số đã lựa hiện tại (${daLua})`,
        { code: 'SO_LUONG_LO_THAP_HON_DA_LUA', details: { so_luong_lo: Number(so_luong_lo), da_lua: daLua } }
      );
    }

    // Mỗi lỗi nội bộ cũng có trần = so_luong_lo: khi HẠ so_luong_lo, không cho thấp hơn số đã
    // xử lý của bất kỳ lỗi nội bộ nào. Chỉ kiểm khi thực sự hạ xuống (lô đã lố sẵn từ trước vẫn
    // sửa được các thông tin khác như nhà cung cấp, ngày sản xuất).
    if (so_luong_lo !== undefined && so_luong_lo !== null) {
      const hienTai = await pool.query('SELECT so_luong_lo FROM Lo WHERE id = $1', [req.params.id]);
      if (hienTai.rows[0] && Number(so_luong_lo) < Number(hienTai.rows[0].so_luong_lo)) {
        const cao = await pool.query(
          `SELECT ll.ten_loi, SUM(bc.tong_lua) AS tong
           FROM BaoCao bc
           JOIN LoaiLoi ll ON ll.id = bc.loi_chuan_id
           WHERE bc.lo_id = $1 AND bc.la_lua_lai = FALSE AND ll.la_loi_noi_bo = TRUE
           GROUP BY ll.id, ll.ten_loi
           HAVING SUM(bc.tong_lua) > $2
           ORDER BY SUM(bc.tong_lua) DESC
           LIMIT 1`,
          [req.params.id, so_luong_lo]
        );
        if (cao.rows[0]) {
          throw new AppError(
            400,
            `so_luong_lo (${so_luong_lo}) không được nhỏ hơn số đã xử lý của lỗi nội bộ "${cao.rows[0].ten_loi}" (${Number(cao.rows[0].tong)})`,
            {
              code: 'SO_LUONG_LO_THAP_HON_NOI_BO',
              details: { so_luong_lo: Number(so_luong_lo), ten_loi: cao.rows[0].ten_loi, da_xu_ly: Number(cao.rows[0].tong) },
            }
          );
        }
      }
    }

    const result = await pool.query(
      `UPDATE Lo SET so_lo = $1, ma_vat_tu = $2, ngay_san_xuat = $3, so_luong_lo = COALESCE($4, so_luong_lo), ma_ncc = $5
       WHERE id = $6 RETURNING *`,
      [so_lo, ma_vat_tu, ngay_san_xuat || null, so_luong_lo, ma_ncc || null, req.params.id]
    );
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy lô');
    res.json(result.rows[0]);
  }
);

// DELETE /api/lo/:id - admin xóa lô (chặn nếu đã có báo cáo liên quan)
router.delete(
  '/:id',
  requireStaff,
  async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM Lo WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy lô');
      res.json({ message: 'Xóa lô thành công' });
    } catch (err) {
      if (err.code === '23503') {
        throw new AppError(409, 'Không thể xóa: lô này đã có báo cáo liên quan');
      }
      throw err;
    }
  }
);

module.exports = router;
