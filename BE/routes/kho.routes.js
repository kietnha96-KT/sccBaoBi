const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const LAYOUT_FILE = path.join(__dirname, '..', 'data', 'kho-layout.json');

// GET /api/kho/layout - bố cục không gian kho (x, z, xoay, kích thước ô) để FE dựng bản đồ 3D.
// Layout không lưu trong DB mà nằm ở data/kho-layout.json (ít đổi). Đọc lại file mỗi lần gọi (~20KB)
// nên sửa file là có hiệu lực ngay, không cần restart server.
router.get('/layout', async (req, res) => {
  const text = await fs.promises.readFile(LAYOUT_FILE, 'utf8');
  res.type('application/json').send(text);
});

module.exports = router;
