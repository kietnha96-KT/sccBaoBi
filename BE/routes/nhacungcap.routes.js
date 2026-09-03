const express = require('express');
const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { readRows, importCatalogByCode } = require('../utils/excelImport');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

const router = express.Router();
router.use(authenticateToken);

const rawFile = express.raw({ type: () => true, limit: '15mb' });

// GET /api/nhacungcap - danh sach nha cung cap (moi nguoi dang nhap), co phan trang + tim kiem
// ?search= tim theo ma hoac ten
// ?limit=<cao> de lay full danh sach cho dropdown/select
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const conditions = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(ma_ncc ILIKE $${params.length} OR ten_ncc ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM NhaCungCap ${where}`, params);
    const total = Number(countResult.rows[0].count);

    const dataResult = await pool.query(
      `SELECT * FROM NhaCungCap ${where} ORDER BY ma_ncc ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ data: dataResult.rows, pagination: buildPaginationMeta({ page, limit, total }) });
  })
);

// GET /api/nhacungcap/export
router.get(
  '/export',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM NhaCungCap ORDER BY ma_ncc ASC');
    await sendExcel(res, {
      sheetName: 'NhaCungCap',
      fileName: 'danh_muc_nha_cung_cap',
      columns: [
        { header: 'Mã nhà cung cấp', key: 'ma_ncc', width: 20 },
        { header: 'Tên nhà cung cấp', key: 'ten_ncc', width: 40 },
      ],
      rows: result.rows,
    });
  })
);

// POST /api/nhacungcap/import - admin nạp danh sách nhà cung cấp từ file Excel (.xlsx)
// Cột chấp nhận (dòng đầu là tiêu đề): Mã nhà cung cấp, Tên nhà cung cấp.
// Mã đã tồn tại -> KHÔNG nạp, chỉ liệt kê lại để tự xử lý.
router.post(
  '/import',
  requireAdmin,
  rawFile,
  asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new AppError(400, 'Không nhận được file. Hãy chọn 1 file Excel (.xlsx).');
    }
    let rows;
    try {
      ({ rows } = await readRows(req.body, {
        ma_ncc: ['ma nha cung cap', 'ma ncc', 'ma', 'mancc'],
        ten_ncc: ['ten nha cung cap', 'ten ncc', 'ten', 'name'],
      }));
    } catch (e) {
      throw new AppError(400, e.message);
    }

    const result = await importCatalogByCode(pool, rows, {
      table: 'NhaCungCap',
      codeField: 'ma_ncc',
      labelField: 'ten_ncc',
      fields: [
        { name: 'ma_ncc', required: true },
        { name: 'ten_ncc', required: true },
      ],
    });
    res.json(result);
  })
);

// GET /api/nhacungcap/:ma_ncc
router.get(
  '/:ma_ncc',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM NhaCungCap WHERE ma_ncc = $1', [
      req.params.ma_ncc,
    ]);
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhà cung cấp');
    res.json(result.rows[0]);
  })
);

// POST /api/nhacungcap - admin tao nha cung cap moi
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { ma_ncc, ten_ncc } = req.body;
    if (!ma_ncc || !ten_ncc) {
      throw new AppError(400, 'Thiếu ma_ncc hoặc ten_ncc');
    }
    const existed = await pool.query('SELECT ma_ncc FROM NhaCungCap WHERE ma_ncc = $1', [ma_ncc]);
    if (existed.rows[0]) throw new AppError(409, 'Mã nhà cung cấp đã tồn tại');

    const result = await pool.query(
      'INSERT INTO NhaCungCap (ma_ncc, ten_ncc) VALUES ($1, $2) RETURNING *',
      [ma_ncc, ten_ncc]
    );
    res.status(201).json(result.rows[0]);
  })
);

// PUT /api/nhacungcap/:ma_ncc - admin sua ten nha cung cap
router.put(
  '/:ma_ncc',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { ten_ncc } = req.body;
    if (!ten_ncc) throw new AppError(400, 'Thiếu ten_ncc');

    const result = await pool.query(
      'UPDATE NhaCungCap SET ten_ncc = $1 WHERE ma_ncc = $2 RETURNING *',
      [ten_ncc, req.params.ma_ncc]
    );
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhà cung cấp');
    res.json(result.rows[0]);
  })
);

// DELETE /api/nhacungcap/:ma_ncc - admin xoa (chan neu da co lo lien quan)
router.delete(
  '/:ma_ncc',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      const result = await pool.query(
        'DELETE FROM NhaCungCap WHERE ma_ncc = $1 RETURNING ma_ncc',
        [req.params.ma_ncc]
      );
      if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhà cung cấp');
      res.json({ message: 'Xóa nhà cung cấp thành công' });
    } catch (err) {
      if (err.code === '23503') {
        throw new AppError(409, 'Không thể xóa: nhà cung cấp này đã được gán cho lô');
      }
      throw err;
    }
  })
);

module.exports = router;
