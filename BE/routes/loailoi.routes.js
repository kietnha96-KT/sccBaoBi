const express = require('express');
const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

const router = express.Router();
router.use(authenticateToken);

const LOAILOI_SELECT = `
  SELECT ll.*, v.ten_vat_tu
  FROM LoaiLoi ll
  JOIN VatTu v ON v.ma_vat_tu = ll.ma_vat_tu
`;

// GET /api/loailoi?ma_vat_tu=xxx - co phan trang (mac dinh 15/trang)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { ma_vat_tu } = req.query;
    const { page, limit, offset } = getPagination(req.query);
    const params = [];
    let where = '';
    if (ma_vat_tu) {
      params.push(ma_vat_tu);
      where = `WHERE ll.ma_vat_tu = $${params.length}`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM LoaiLoi ll ${where}`,
      params
    );
    const total = Number(countResult.rows[0].count);

    const dataResult = await pool.query(
      `${LOAILOI_SELECT} ${where} ORDER BY v.ma_vat_tu, ll.ten_loi LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
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
      ],
      rows: result.rows,
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
    const { ma_vat_tu, ten_loi } = req.body;
    if (!ma_vat_tu || !ten_loi) {
      throw new AppError(400, 'Thiếu ma_vat_tu hoặc ten_loi');
    }
    const vt = await pool.query('SELECT ma_vat_tu FROM VatTu WHERE ma_vat_tu = $1', [
      ma_vat_tu,
    ]);
    if (!vt.rows[0]) throw new AppError(400, 'Mã vật tư không tồn tại');

    const result = await pool.query(
      'INSERT INTO LoaiLoi (ma_vat_tu, ten_loi) VALUES ($1, $2) RETURNING *',
      [ma_vat_tu, ten_loi]
    );
    res.status(201).json(result.rows[0]);
  })
);

// PUT /api/loailoi/:id - admin sửa
router.put(
  '/:id',
  requireStaff,
  asyncHandler(async (req, res) => {
    const { ten_loi } = req.body;
    if (!ten_loi) throw new AppError(400, 'Thiếu ten_loi');

    const result = await pool.query(
      'UPDATE LoaiLoi SET ten_loi = $1 WHERE id = $2 RETURNING *',
      [ten_loi, req.params.id]
    );
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy loại lỗi');
    res.json(result.rows[0]);
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
          'Không thể xóa: loại lỗi này đang được gán cho báo cáo. Hãy gỡ nhãn ở các báo cáo liên quan trước.'
        );
      }
      throw err;
    }
  })
);

module.exports = router;
