const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');

const router = express.Router();
router.use(authenticateToken);

const SAFE_COLUMNS = 'id, ho_ten, username, vai_tro, created_at';

// GET /api/nhansu - danh sách nhân sự (mọi người đăng nhập đều xem được, để chọn khi nhập báo cáo)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM NhanSu ORDER BY ho_ten ASC`
    );
    res.json(result.rows);
  })
);

// GET /api/nhansu/export - xuất Excel danh sách nhân sự (admin)
router.get(
  '/export',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM NhanSu ORDER BY ho_ten ASC`
    );
    await sendExcel(res, {
      sheetName: 'NhanSu',
      fileName: 'danh_sach_nhan_su',
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Họ tên', key: 'ho_ten', width: 30 },
        { header: 'Username', key: 'username', width: 20 },
        { header: 'Vai trò', key: 'vai_tro', width: 15 },
        { header: 'Ngày tạo', key: 'created_at', width: 20 },
      ],
      rows: result.rows,
    });
  })
);

// GET /api/nhansu/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query(`SELECT ${SAFE_COLUMNS} FROM NhanSu WHERE id = $1`, [
      req.params.id,
    ]);
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhân sự');
    res.json(result.rows[0]);
  })
);

// POST /api/nhansu - admin tạo tài khoản mới
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { ho_ten, username, password, vai_tro } = req.body;
    if (!ho_ten || !username || !password) {
      throw new AppError(400, 'Thiếu ho_ten, username hoặc password');
    }
    if (vai_tro && !['admin', 'nhan_vien'].includes(vai_tro)) {
      throw new AppError(400, 'vai_tro không hợp lệ');
    }
    if (password.length < 6) {
      throw new AppError(400, 'Mật khẩu phải có ít nhất 6 ký tự');
    }

    const existed = await pool.query('SELECT id FROM NhanSu WHERE username = $1', [
      username,
    ]);
    if (existed.rows[0]) {
      throw new AppError(409, 'Username đã tồn tại');
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO NhanSu (ho_ten, username, password, vai_tro)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SAFE_COLUMNS}`,
      [ho_ten, username, hashed, vai_tro || 'nhan_vien']
    );
    res.status(201).json(result.rows[0]);
  })
);

// PUT /api/nhansu/:id - admin sửa họ tên / vai trò
router.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { ho_ten, vai_tro } = req.body;
    if (!ho_ten) throw new AppError(400, 'Thiếu ho_ten');
    if (vai_tro && !['admin', 'nhan_vien'].includes(vai_tro)) {
      throw new AppError(400, 'vai_tro không hợp lệ');
    }

    const result = await pool.query(
      `UPDATE NhanSu SET ho_ten = $1, vai_tro = COALESCE($2, vai_tro)
       WHERE id = $3 RETURNING ${SAFE_COLUMNS}`,
      [ho_ten, vai_tro || null, req.params.id]
    );
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhân sự');
    res.json(result.rows[0]);
  })
);

// PUT /api/nhansu/:id/reset-password - admin đặt lại mật khẩu cho nhân sự
router.put(
  '/:id/reset-password',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { mat_khau_moi } = req.body;
    if (!mat_khau_moi || mat_khau_moi.length < 6) {
      throw new AppError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');
    }
    const hashed = await bcrypt.hash(mat_khau_moi, 10);
    const result = await pool.query(
      `UPDATE NhanSu SET password = $1 WHERE id = $2 RETURNING ${SAFE_COLUMNS}`,
      [hashed, req.params.id]
    );
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhân sự');
    res.json({ message: 'Đặt lại mật khẩu thành công' });
  })
);

// DELETE /api/nhansu/:id - admin xóa tài khoản (chặn nếu đã có báo cáo liên quan)
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (Number(req.params.id) === req.user.id) {
      throw new AppError(400, 'Không thể tự xóa tài khoản của chính mình');
    }
    try {
      const result = await pool.query('DELETE FROM NhanSu WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhân sự');
      res.json({ message: 'Xóa nhân sự thành công' });
    } catch (err) {
      if (err.code === '23503') {
        throw new AppError(
          409,
          'Không thể xóa: nhân sự này đã có báo cáo hoặc tham gia báo cáo liên quan'
        );
      }
      throw err;
    }
  })
);

module.exports = router;
