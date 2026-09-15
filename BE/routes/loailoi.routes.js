const express = require('express');
const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { readRows, importLoaiLoi } = require('../utils/excelImport');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { buildOrderBy } = require('../utils/sort');

const router = express.Router();
router.use(authenticateToken);

const LOAILOI_SORT_COLUMNS = {
  ma_vat_tu: 'v.ma_vat_tu',
  ten_vat_tu: 'v.ten_vat_tu',
  ten_loi: 'll.ten_loi',
  muc_dich: 'll.muc_dich',
  la_loi_dac_biet: 'll.la_loi_dac_biet',
};

const rawFile = express.raw({ type: () => true, limit: '15mb' });

const MUC_DICH_HOP_LE = ['gan_nhan', 'tach_hu_bo', 'ca_hai'];
const MUC_DICH_LABEL = { gan_nhan: 'Gán nhãn', tach_hu_bo: 'Tách hư bỏ', ca_hai: 'Cả hai' };
function chuanHoaMucDich(v) {
  if (v === undefined || v === null || v === '') return 'gan_nhan';
  if (!MUC_DICH_HOP_LE.includes(v)) {
    throw new AppError(400, "muc_dich phải là 'gan_nhan', 'tach_hu_bo' hoặc 'ca_hai'");
  }
  return v;
}

const LOAILOI_SELECT = `
  SELECT ll.*, v.ten_vat_tu
  FROM LoaiLoi ll
  JOIN VatTu v ON v.ma_vat_tu = ll.ma_vat_tu
`;

// GET /api/loailoi?ma_vat_tu=xxx - co phan trang (mac dinh 15/trang)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { ma_vat_tu, thu_kho } = req.query;
    const { page, limit, offset } = getPagination(req.query);
    const params = [];
    const conditions = [];
    if (ma_vat_tu) {
      params.push(ma_vat_tu);
      conditions.push(`ll.ma_vat_tu = $${params.length}`);
    }
    if (thu_kho) {
      params.push(thu_kho);
      conditions.push(`v.thu_kho = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM LoaiLoi ll JOIN VatTu v ON v.ma_vat_tu = ll.ma_vat_tu ${where}`,
      params
    );
    const total = Number(countResult.rows[0].count);

    const orderBy = buildOrderBy(req.query, LOAILOI_SORT_COLUMNS, 'ORDER BY v.ma_vat_tu, ll.ten_loi');
    const dataResult = await pool.query(
      `${LOAILOI_SELECT} ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: dataResult.rows, pagination: buildPaginationMeta({ page, limit, total }) });
  })
);

// GET /api/loailoi/export
router.get(
  '/export',
  requireStaff,
  asyncHandler(async (req, res) => {
    const result = await pool.query(`${LOAILOI_SELECT} ORDER BY v.ma_vat_tu, ll.ten_loi`);
    await sendExcel(res, {
      sheetName: 'LoaiLoi',
      fileName: 'danh_muc_loi',
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 15 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 30 },
        { header: 'Tên lỗi', key: 'ten_loi', width: 35 },
        { header: 'Lỗi đặc biệt', key: '_dac_biet_txt', width: 12 },
        { header: 'Mục đích', key: '_muc_dich_txt', width: 16 },
      ],
      rows: result.rows.map((r) => ({
        ...r,
        _dac_biet_txt: r.la_loi_dac_biet ? 'Có' : '',
        _muc_dich_txt: MUC_DICH_LABEL[r.muc_dich] || r.muc_dich,
      })),
    });
  })
);

// POST /api/loailoi/import - nạp danh sách loại lỗi từ file Excel (.xlsx)
// Cột chấp nhận (dòng đầu là tiêu đề): Mã vật tư, Tên lỗi.
// Mã vật tư phải tồn tại; cặp (mã vật tư + tên lỗi) đã có -> bỏ qua (không tạo trùng).
router.post(
  '/import',
  requireStaff,
  rawFile,
  asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new AppError(400, 'Không nhận được file. Hãy chọn 1 file Excel (.xlsx).');
    }
    let rows;
    try {
      ({ rows } = await readRows(req.body, {
        ma_vat_tu: ['ma vat tu', 'ma', 'mavt'],
        ten_loi: ['ten loi', 'loi', 'ten'],
      }));
    } catch (e) {
      throw new AppError(400, e.message);
    }

    const result = await importLoaiLoi(pool, rows);
    res.json(result);
  })
);

// GET /api/loailoi/:id/tac-dong - xem trước hệ quả nếu đổi mục đích loại lỗi này.
//  - so_bao_cao_chi_tiet / tong_so_luong_chi_tiet: khi chuyển sang 'gan_nhan' -> xóa bấy nhiêu
//    dòng hư bỏ chi tiết (số nhân viên đã nhập).
//  - so_bao_cao_gan_nhan: khi chuyển sang 'tach_hu_bo' -> gỡ nhãn lỗi chuẩn ở bấy nhiêu báo cáo.
router.get(
  '/:id/tac-dong',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const [ct, nhan] = await Promise.all([
      pool.query(
        'SELECT COUNT(*)::int AS n, COALESCE(SUM(so_luong), 0) AS tong FROM BaoCao_LoiChiTiet WHERE loai_loi_id = $1',
        [id]
      ),
      pool.query('SELECT COUNT(*)::int AS n FROM BaoCao WHERE loi_chuan_id = $1', [id]),
    ]);
    res.json({
      so_bao_cao_chi_tiet: ct.rows[0].n,
      tong_so_luong_chi_tiet: Number(ct.rows[0].tong),
      so_bao_cao_gan_nhan: nhan.rows[0].n,
    });
  })
);

// GET /api/loailoi/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query(`${LOAILOI_SELECT} WHERE ll.id = $1`, [
      req.params.id,
    ]);
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy loại lỗi');
    res.json(result.rows[0]);
  })
);

// POST /api/loailoi - admin tạo loại lỗi mới cho 1 vật tư
router.post(
  '/',
  requireStaff,
  asyncHandler(async (req, res) => {
    const { ma_vat_tu, ten_loi, la_loi_dac_biet = false } = req.body;
    if (!ma_vat_tu || !ten_loi) {
      throw new AppError(400, 'Thiếu ma_vat_tu hoặc ten_loi');
    }
    // Lỗi đặc biệt luôn khóa muc_dich = 'gan_nhan': thao tác nội bộ, báo cáo gọi đích
    // danh, và cơ chế loại khỏi tổng lô chạy theo nhãn lỗi chuẩn.
    const muc_dich = la_loi_dac_biet ? 'gan_nhan' : chuanHoaMucDich(req.body.muc_dich);
    const vt = await pool.query('SELECT ma_vat_tu FROM VatTu WHERE ma_vat_tu = $1', [
      ma_vat_tu,
    ]);
    if (!vt.rows[0]) throw new AppError(400, 'Mã vật tư không tồn tại');

    const result = await pool.query(
      'INSERT INTO LoaiLoi (ma_vat_tu, ten_loi, la_loi_dac_biet, muc_dich) VALUES ($1, $2, $3, $4) RETURNING *',
      [ma_vat_tu, ten_loi, !!la_loi_dac_biet, muc_dich]
    );
    res.status(201).json(result.rows[0]);
  })
);

// PUT /api/loailoi/:id - admin sửa.
// Nếu loại lỗi thành 'tach_hu_bo' -> gỡ nhãn lỗi chuẩn ở mọi báo cáo đang trỏ tới nó
// (loại lỗi chỉ-để-tách không còn là nhãn hợp lệ; dropdown "gắn lỗi chuẩn" cũng ẩn nó).
router.put(
  '/:id',
  requireStaff,
  asyncHandler(async (req, res) => {
    const { ten_loi, la_loi_dac_biet } = req.body;
    if (!ten_loi) throw new AppError(400, 'Thiếu ten_loi');
    const muc_dich =
      req.body.muc_dich === undefined ? null : chuanHoaMucDich(req.body.muc_dich);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE LoaiLoi
         SET ten_loi = $1,
             la_loi_dac_biet = COALESCE($2, la_loi_dac_biet),
             muc_dich = CASE
               WHEN COALESCE($2, la_loi_dac_biet) = TRUE THEN 'gan_nhan'
               ELSE COALESCE($3, muc_dich)
             END
         WHERE id = $4 RETURNING *`,
        [ten_loi, la_loi_dac_biet ?? null, muc_dich, req.params.id]
      );
      if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy loại lỗi');

      // Dọn cho khớp mục đích mới. Trước khi xóa/gỡ -> chép dữ liệu sắp mất vào bảng lưu vết.
      const mucDichMoi = result.rows[0].muc_dich;
      const boiId = req.user?.id ?? null;
      const boiTen = req.user?.ho_ten ?? null;
      let go_nhan = 0;
      let go_chi_tiet = 0;
      if (mucDichMoi === 'tach_hu_bo') {
        // Không còn là nhãn hợp lệ -> gỡ khỏi mọi báo cáo đang gán (lưu vết nhãn cũ).
        await client.query(
          `INSERT INTO BaoCao_Loi_LichSuXoa
             (loai, baocao_id, lo_id, so_lo, hu_bo_goc, loai_loi_id, ten_loi, so_luong, xoa_boi_id, xoa_boi_ten)
           SELECT 'nhan_loi_chuan', bc.id, bc.lo_id, l.so_lo, bc.hu_bo, ll.id, ll.ten_loi, NULL, $2, $3
           FROM BaoCao bc
           JOIN Lo l ON l.id = bc.lo_id
           JOIN LoaiLoi ll ON ll.id = bc.loi_chuan_id
           WHERE bc.loi_chuan_id = $1`,
          [req.params.id, boiId, boiTen]
        );
        const upd = await client.query(
          'UPDATE BaoCao SET loi_chuan_id = NULL WHERE loi_chuan_id = $1',
          [req.params.id]
        );
        go_nhan = upd.rowCount;
      }
      if (mucDichMoi === 'gan_nhan') {
        // Không còn để tách hư bỏ -> xóa dòng chi tiết cũ (số lượng dồn về "chưa phân loại"),
        // lưu vết từng dòng: báo cáo nào, lỗi gì, số lượng bao nhiêu.
        await client.query(
          `INSERT INTO BaoCao_Loi_LichSuXoa
             (loai, baocao_id, lo_id, so_lo, hu_bo_goc, loai_loi_id, ten_loi, so_luong, xoa_boi_id, xoa_boi_ten)
           SELECT 'chi_tiet_hu_bo', ct.baocao_id, bc.lo_id, l.so_lo, bc.hu_bo, ll.id, ll.ten_loi, ct.so_luong, $2, $3
           FROM BaoCao_LoiChiTiet ct
           JOIN BaoCao bc ON bc.id = ct.baocao_id
           JOIN Lo l ON l.id = bc.lo_id
           JOIN LoaiLoi ll ON ll.id = ct.loai_loi_id
           WHERE ct.loai_loi_id = $1`,
          [req.params.id, boiId, boiTen]
        );
        const del = await client.query(
          'DELETE FROM BaoCao_LoiChiTiet WHERE loai_loi_id = $1',
          [req.params.id]
        );
        go_chi_tiet = del.rowCount;
      }

      await client.query('COMMIT');
      res.json({ ...result.rows[0], _go_nhan_loi_chuan: go_nhan, _go_chi_tiet_hu_bo: go_chi_tiet });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// DELETE /api/loailoi/:id - admin xóa (chặn nếu đã có báo cáo đang gán nhãn lỗi này)
router.delete(
  '/:id',
  requireStaff,
  asyncHandler(async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM LoaiLoi WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy loại lỗi');
      res.json({ message: 'Xóa loại lỗi thành công' });
    } catch (err) {
      if (err.code === '23503') {
        throw new AppError(
          409,
          'Không thể xóa: loại lỗi này đang được dùng ở báo cáo (nhãn lỗi chuẩn hoặc hư bỏ chi tiết). Hãy gỡ ở các báo cáo liên quan trước.'
        );
      }
      throw err;
    }
  })
);

module.exports = router;
