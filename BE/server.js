// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const pool = require('./db');
const openapiSpec = require('./openapi');

const authRoutes = require('./routes/auth.routes');
const nhansuRoutes = require('./routes/nhansu.routes');
const vattuRoutes = require('./routes/vattu.routes');
const loRoutes = require('./routes/lo.routes');
const loailoiRoutes = require('./routes/loailoi.routes');
const baocaoRoutes = require('./routes/baocao.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

// CORS_ORIGIN: danh sách domain frontend được phép gọi API, cách nhau dấu phẩy.
// Để trống (mặc định lúc dev) = cho phép tất cả.
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));

app.use(express.json());

// API test: kiểm tra kết nối database có thành công không
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      message: 'Kết nối database thành công!',
      thoi_gian_server: result.rows[0].now,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi kết nối database', error: err.message });
  }
});

// Trang xem tổng quát toàn bộ API + bấm thử trực tiếp: http://localhost:5000/api-docs
app.get('/api-docs.json', (req, res) => res.json(openapiSpec));
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, { customSiteTitle: 'SCC Bao Bi - API Docs' })
);

app.use('/api/auth', authRoutes);
app.use('/api/nhansu', nhansuRoutes);
app.use('/api/vattu', vattuRoutes);
app.use('/api/lo', loRoutes);
app.use('/api/loailoi', loailoiRoutes);
app.use('/api/baocao', baocaoRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 cho route không tồn tại
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Không tìm thấy endpoint' });
});

// Error handler tập trung
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).json({ message: err.message || 'Lỗi máy chủ' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
