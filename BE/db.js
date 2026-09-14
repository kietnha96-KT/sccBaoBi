// db.js - Kết nối PostgreSQL dùng chung cho toàn bộ app
const { Pool, types } = require('pg');

// Cột DATE (OID 1082): trả về NGUYÊN chuỗi 'YYYY-MM-DD', KHÔNG ép sang Date.
// Mặc định node-pg parse DATE thành Date ở nửa đêm theo múi giờ tiến trình, rồi
// res.json() lại đổi sang UTC -> nếu server chạy múi giờ +7 (máy local) thì ngày
// bị lùi 1 (vd 2026-08-31 -> "2026-08-30T17:00:00Z"). Giữ nguyên chuỗi là an toàn nhất.
types.setTypeParser(1082, (v) => v);

// Ép idle timeout ngắn + KHÔNG giữ connection tối thiểu nào -> pool tự đóng hết connection
// vật lý khi rảnh, để compute Neon (serverless, tính giờ compute) tự "ngủ" được.
// (Đây vốn đã là default của thư viện pg - ghi tường minh ra để không ai lỡ thêm
//  "min: 1" hay tăng idleTimeoutMillis rồi vô tình làm connection treo, khiến Neon
//  không bao giờ suspend compute -> ăn hết giờ compute của gói free.)
const POOL_KEEP_IDLE_SHORT = {
  min: 0,
  idleTimeoutMillis: 10000, // 10s không dùng -> đóng connection
};

// Ưu tiên DATABASE_URL (chuẩn connection string mà Render/Neon/Supabase... cung cấp).
// Không có thì dùng các biến DB_* riêng lẻ (phù hợp chạy local).
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      ...POOL_KEEP_IDLE_SHORT,
    })
  : new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      ...POOL_KEEP_IDLE_SHORT,
    });

// Ép search_path = public trên MỌI connection vật lý mới của pool. Cần thiết cho Neon:
// role mặc định qua endpoint pooler có search_path rỗng (khác Render/local là "public"
// theo mặc định) -> mọi câu query không ghi schema (kiểu "FROM BaoCao") sẽ báo
// "relation does not exist" nếu thiếu dòng này. Vô hại ở Render/local vì public vốn
// đã là default ở đó.
pool.on('connect', (client) => {
  client.query('SET search_path TO public').catch((err) => {
    console.error('Không đặt được search_path cho connection mới:', err.message);
  });
});

module.exports = pool;
