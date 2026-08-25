// Đặt lại mật khẩu cho 1 tài khoản có sẵn - dùng khi không còn ai đăng nhập được để tự đặt lại trên web.
// Cách dùng (local, đọc .env):        node scripts/reset-password.js username mat_khau_moi
// Cách dùng (DB cloud như Render):    DATABASE_URL="postgres://..." node scripts/reset-password.js username mat_khau_moi
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');

async function main() {
  const [, , username, password] = process.argv;
  if (!username || !password) {
    console.error('Cách dùng: node scripts/reset-password.js username mat_khau_moi');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Mật khẩu mới phải có ít nhất 6 ký tự');
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);
  const result = await pool.query(
    'UPDATE NhanSu SET password = $1 WHERE username = $2 RETURNING id, ho_ten, username, vai_tro',
    [hashed, username]
  );

  if (!result.rows[0]) {
    console.error(`Không tìm thấy username "${username}"`);
    process.exit(1);
  }

  console.log('Đặt lại mật khẩu thành công cho:', result.rows[0]);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
