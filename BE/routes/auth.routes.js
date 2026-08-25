const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login - đăng nhập, không có tự đăng ký (admin tạo tài khoản)
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new AppError(400, 'Thiếu username hoặc password');
    }

    const result = await pool.query(
      'SELECT id, ho_ten, username, password, vai_tro FROM NhanSu WHERE username = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user) {
      throw new AppError(401, 'Sai username hoặc password');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      throw new AppError(401, 'Sai username hoặc password');
    }

    const payload = {
      id: user.id,
      username: user.username,
      ho_ten: user.ho_ten,
      vai_tro: user.vai_tro,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({ token, user: payload });
  })
);

// GET /api/auth/me - lấy thông tin người đang đăng nhập
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT id, ho_ten, username, vai_tro, created_at FROM NhanSu WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) {
      throw new AppError(404, 'Không tìm thấy người dùng');
    }
    res.json(result.rows[0]);
  })
);

// PUT /api/auth/change-password - người dùng tự đổi mật khẩu của mình
router.put(
  '/change-password',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { mat_khau_cu, mat_khau_moi } = req.body;
    if (!mat_khau_cu || !mat_khau_moi) {
      throw new AppError(400, 'Thiếu mật khẩu cũ hoặc mật khẩu mới');
    }
    if (mat_khau_moi.length < 6) {
      throw new AppError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    const result = await pool.query('SELECT password FROM NhanSu WHERE id = $1', [
      req.user.id,
    ]);
    const user = result.rows[0];
    if (!user) {
      throw new AppError(404, 'Không tìm thấy người dùng');
    }

    const match = await bcrypt.compare(mat_khau_cu, user.password);
    if (!match) {
      throw new AppError(401, 'Mật khẩu cũ không đúng');
    }

    const hashed = await bcrypt.hash(mat_khau_moi, 10);
    await pool.query('UPDATE NhanSu SET password = $1 WHERE id = $2', [
      hashed,
      req.user.id,
    ]);

    res.json({ message: 'Đổi mật khẩu thành công' });
  })
);

module.exports = router;
