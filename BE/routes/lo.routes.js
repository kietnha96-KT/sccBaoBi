const express = require('express');
const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

const router = express.Router();
router.use(authenticateToken);

// Subquery: đã lựa (chỉ tính báo cáo không phải lựa lại) + còn lại so với so_luong_lo
const LO_SELECT = `
  SELECT
    l.*,
    v.ten_vat_tu,
    n.ten_ncc,
    COALESCE((
      SELECT SUM(bc.tong_lua) FROM BaoCao bc
      WHERE bc.lo_id = l.id AND bc.la_lua_lai = FALSE
    ), 0) AS da_lua,
    l.so_luong_lo - COALESCE((
      SELECT SUM(bc.tong_lua) FROM BaoCao bc
      WHERE bc.lo_id = l.id AND bc.la_lua_lai = FALSE
    ), 0) AS con_lai
  FROM Lo l
  JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu
  LEFT JOIN NhaCungCap n ON n.ma_ncc = l.ma_ncc
`;

// GET /api/lo - danh sách lô, lọc theo ma_vat_tu / so_lo, co phan trang (mac dinh 15/trang)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { ma_vat_tu, so_lo } = req.query;
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

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM Lo l ${where}`,
      params
    );
    const total = Number(countResult.rows[0].count);

    const dataResult = await pool.query(
      `${LO_SELECT} ${where} ORDER BY l.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: dataResult.rows, pagination: buildPaginationMeta({ page, limit, total }) });
  })
);

// GET /api/lo/export
router.get(
  '/export',
  requireStaff,
  asyncHandler(async (req, res) => {
    const result = await pool.query(`${LO_SELECT} ORDER BY l.id DESC`);
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
        { header: 'Đã lựa', key: 'da_lua', width: 15 },
        { header: 'Còn lại', key: 'con_lai', width: 15 },
      ],
      rows: result.rows,
    });
  })
);

// GET /api/lo/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query(`${LO_SELECT} WHERE l.id = $1`, [req.params.id]);
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy lô');
    res.json(result.rows[0]);
  })
);

// POST /api/lo - admin tạo lô mới
router.post(
  '/',
  requireStaff,
  asyncHandler(async (req, res) => {
    const { so_lo, ma_vat_tu, ngay_san_xuat, so_luong_lo, ma_ncc } = req.body;
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

    const result = await pool.query(
      `INSERT INTO Lo (so_lo, ma_vat_tu, ngay_san_xuat, so_luong_lo, ma_ncc)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [so_lo, ma_vat_tu, ngay_san_xuat || null, so_luong_lo ?? 0, ma_ncc || null]
    );
    res.status(201).json(result.rows[0]);
  })
);

// PUT /api/lo/:id - admin sửa lô
router.put(
  '/:id',
  requireStaff,
  asyncHandler(async (req, res) => {
    const { so_lo, ma_vat_tu, ngay_san_xuat, so_luong_lo, ma_ncc } = req.body;
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

    // Không cho hạ so_luong_lo xuống thấp hơn số đã lựa thực tế (tránh dữ liệu vô lý)
    const daLuaResult = await pool.query(
      `SELECT COALESCE(SUM(tong_lua), 0) AS da_lua FROM BaoCao WHERE lo_id = $1 AND la_lua_lai = FALSE`,
      [req.params.id]
    );
    const daLua = Number(daLuaResult.rows[0].da_lua);
    if (so_luong_lo !== undefined && Number(so_luong_lo) < daLua) {
      throw new AppError(
        400,
        `so_luong_lo (${so_luong_lo}) không được nhỏ hơn số đã lựa hiện tại (${daLua})`
      );
    }

    const result = await pool.query(
      `UPDATE Lo SET so_lo = $1, ma_vat_tu = $2, ngay_san_xuat = $3, so_luong_lo = COALESCE($4, so_luong_lo), ma_ncc = $5
       WHERE id = $6 RETURNING *`,
      [so_lo, ma_vat_tu, ngay_san_xuat || null, so_luong_lo, ma_ncc || null, req.params.id]
    );
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy lô');
    res.json(result.rows[0]);
  })
);

// DELETE /api/lo/:id - admin xóa lô (chặn nếu đã có báo cáo liên quan)
router.delete(
  '/:id',
  requireStaff,
  asyncHandler(async (req, res) => {
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
  })
);

module.exports = router;
