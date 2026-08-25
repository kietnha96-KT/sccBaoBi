// db.js - Kết nối PostgreSQL dùng chung cho toàn bộ app
const { Pool } = require('pg');

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
