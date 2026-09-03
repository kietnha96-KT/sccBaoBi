// db.js - Kết nối PostgreSQL dùng chung cho toàn bộ app
const { Pool, types } = require('pg');

// Cột DATE (OID 1082): trả về NGUYÊN chuỗi 'YYYY-MM-DD', KHÔNG ép sang Date.
// Mặc định node-pg parse DATE thành Date ở nửa đêm theo múi giờ tiến trình, rồi
// res.json() lại đổi sang UTC -> nếu server chạy múi giờ +7 (máy local) thì ngày
// bị lùi 1 (vd 2026-08-31 -> "2026-08-30T17:00:00Z"). Giữ nguyên chuỗi là an toàn nhất.
types.setTypeParser(1082, (v) => v);

// Ưu tiên DATABASE_URL (chuẩn connection string mà Render/Neon/Supabase... cung cấp).
// Không có thì dùng các biến DB_* riêng lẻ (phù hợp chạy local).
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
    });

module.exports = pool;
