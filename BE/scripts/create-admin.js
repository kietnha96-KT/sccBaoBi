// Script tạo tài khoản admin đầu tiên (chạy 1 lần lúc khởi tạo hệ thống, vì app không cho tự đăng ký)
// Cách dùng: node scripts/create-admin.js "Nguyen Van A" admin_username mat_khau123
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');

async function main() {
  const [, , ho_ten, username, password] = process.argv;
  if (!ho_ten || !username || !password) {
    console.error('Cách dùng: node scripts/create-admin.js "Họ tên" username mat_khau');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Mật khẩu phải có ít nhất 6 ký tự');
    process.exit(1);
  }

  const existed = await pool.query('SELECT id FROM NhanSu WHERE username = $1', [username]);
  if (existed.rows[0]) {
    console.error(`Username "${username}" đã tồn tại`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO NhanSu (ho_ten, username, password, vai_tro)
     VALUES ($1, $2, $3, 'admin') RETURNING id, ho_ten, username, vai_tro`,
    [ho_ten, username, hashed]
  );
  console.log('Tạo admin thành công:', result.rows[0]);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
