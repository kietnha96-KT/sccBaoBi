const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

// Xác thực JWT, gắn req.user = { id, username, ho_ten, vai_tro }
function authenticateToken(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError(401, 'Thiếu token xác thực'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return next(new AppError(401, 'Token không hợp lệ hoặc đã hết hạn'));
    }
    req.user = payload;
    next();
  });
}

// Chỉ cho phép admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.vai_tro !== 'admin') {
    return next(new AppError(403, 'Chỉ admin mới có quyền thực hiện thao tác này'));
  }
  next();
}

// Cho phép admin HOẶC thủ kho (thu_kho có quyền gần như admin: dashboard, báo cáo,
// và danh mục Lô + Loại lỗi).
function requireStaff(req, res, next) {
  if (!req.user || !['admin', 'thu_kho'].includes(req.user.vai_tro)) {
    return next(new AppError(403, 'Chỉ admin hoặc thủ kho mới có quyền thực hiện thao tác này'));
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, requireStaff };
