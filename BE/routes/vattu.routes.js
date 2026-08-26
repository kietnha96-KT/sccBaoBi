const express = require('express');
const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

const router = express.Router();
router.use(authenticateToken);

// GET /api/vattu - danh sách vật tư (mọi người đăng nhập), co phan trang + tim kiem + loc theo loai
// ?search= tim theo ma hoac ten (ILIKE co dau)
// ?loai= loc dung theo loai vat tu
// ?limit=<cao> de lay full danh sach cho dropdown/select (mac dinh 15/trang cho man hinh danh sach)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, loai } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const conditions = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(ma_vat_tu ILIKE $${params.length} OR ten_vat_tu ILIKE $${params.length})`);
    }
    if (loai) {
      params.push(loai);
      conditions.push(`loai = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM VatTu ${where}`, params);
    const total = Number(countResult.rows[0].count);

    const dataResult = await pool.query(
      `SELECT * FROM VatTu ${where} ORDER BY ma_vat_tu ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ data: dataResult.rows, pagination: buildPaginationMeta({ page, limit, total }) });
  })
);

// GET /api/vattu/loai-list - danh sách các "loại" khác nhau đang có (dùng đổ vào dropdown lọc)
router.get(
  '/loai-list',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT DISTINCT loai FROM VatTu WHERE loai IS NOT NULL AND loai != '' ORDER BY loai ASC`
    );
    res.json(result.rows.map((r) => r.loai));
  })
);

// GET /api/vattu/export
router.get(
  '/export',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM VatTu ORDER BY ma_vat_tu ASC');
    await sendExcel(res, {
      sheetName: 'VatTu',
      fileName: 'danh_muc_vat_tu',
      columns: [
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 15 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 40 },
        { header: 'Loại', key: 'loai', width: 20 },
        { header: 'Thủ kho', key: 'thu_kho', width: 20 },
      ],
      rows: result.rows,
    });
  })
);

// GET /api/vattu/:ma_vat_tu
router.get(
  '/:ma_vat_tu',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM VatTu WHERE ma_vat_tu = $1', [
      req.params.ma_vat_tu,
    ]);
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy vật tư');
    res.json(result.rows[0]);
  })
);

// POST /api/vattu - admin tạo vật tư mới
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { ma_vat_tu, ten_vat_tu, loai, thu_kho } = req.body;
    if (!ma_vat_tu || !ten_vat_tu) {
      throw new AppError(400, 'Thiếu ma_vat_tu hoặc ten_vat_tu');
    }
    const existed = await pool.query('SELECT ma_vat_tu FROM VatTu WHERE ma_vat_tu = $1', [
      ma_vat_tu,
    ]);
    if (existed.rows[0]) throw new AppError(409, 'Mã vật tư đã tồn tại');

    const result = await pool.query(
      'INSERT INTO VatTu (ma_vat_tu, ten_vat_tu, loai, thu_kho) VALUES ($1, $2, $3, $4) RETURNING *',
      [ma_vat_tu, ten_vat_tu, loai || null, thu_kho || null]
    );
    res.status(201).json(result.rows[0]);
  })
);

// PUT /api/vattu/:ma_vat_tu - admin sửa tên/loại/thủ kho vật tư
router.put(
  '/:ma_vat_tu',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { ten_vat_tu, loai, thu_kho } = req.body;
    if (!ten_vat_tu) throw new AppError(400, 'Thiếu ten_vat_tu');

    const result = await pool.query(
      'UPDATE VatTu SET ten_vat_tu = $1, loai = $2, thu_kho = $3 WHERE ma_vat_tu = $4 RETURNING *',
      [ten_vat_tu, loai || null, thu_kho || null, req.params.ma_vat_tu]
    );
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy vật tư');
    res.json(result.rows[0]);
  })
);

// DELETE /api/vattu/:ma_vat_tu - admin xóa vật tư (chặn nếu đã có lô/danh mục lỗi liên quan)
router.delete(
  '/:ma_vat_tu',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM VatTu WHERE ma_vat_tu = $1 RETURNING ma_vat_tu', [
        req.params.ma_vat_tu,
      ]);
      if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy vật tư');
      res.json({ message: 'Xóa vật tư thành công' });
    } catch (err) {
      if (err.code === '23503') {
        throw new AppError(
          409,
          'Không thể xóa: vật tư này đã có lô hoặc danh mục lỗi liên quan'
        );
      }
      throw err;
    }
  })
);

module.exports = router;
