// Chạy 1 file .sql lên database - dùng cho migration/tạo schema.
// Cách dùng (DB local, đọc .env):     node scripts/run-schema.js migrations/xxx.sql
// Cách dùng (DB cloud như Render):    DATABASE_URL="postgres://..." node scripts/run-schema.js migrations/xxx.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error('Cách dùng: node scripts/run-schema.js <duong-dan-file.sql>');
    process.exit(1);
  }

  const sql = fs.readFileSync(path.resolve(sqlPath), 'utf8');
  try {
    await pool.query(sql);
    console.log('Đã chạy xong file:', sqlPath);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});
