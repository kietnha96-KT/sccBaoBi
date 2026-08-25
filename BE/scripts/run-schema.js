// Chạy 1 file .sql lên database trỏ bởi DATABASE_URL (dùng cho DB cloud như Render/Neon).
// Cách dùng: DATABASE_URL="postgres://..." node scripts/run-schema.js ../taobang.sql
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error('Cách dùng: node scripts/run-schema.js <duong-dan-file.sql>');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Thiếu biến môi trường DATABASE_URL');
    process.exit(1);
  }

  const sql = fs.readFileSync(path.resolve(sqlPath), 'utf8');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log('Đã chạy xong file:', sqlPath);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});
