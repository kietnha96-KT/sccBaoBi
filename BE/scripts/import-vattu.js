// Import hàng loạt vật tư từ file .tsv (2 cột: ma_vat_tu, ten_vat_tu, có dòng tiêu đề).
// Tự trim khoảng trắng, tự loại trùng ma_vat_tu (giữ dòng xuất hiện đầu tiên).
// Cách dùng (DB local, đọc .env):     node scripts/import-vattu.js duong_dan_file.tsv
// Cách dùng (DB cloud):               DATABASE_URL="postgres://..." node scripts/import-vattu.js duong_dan_file.tsv
require('dotenv').config();
const fs = require('fs');
const pool = require('../db');

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Cách dùng: node scripts/import-vattu.js duong_dan_file.tsv');
    process.exit(1);
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const [rawMa, rawTen] = line.split('\t');
    const ma = (rawMa || '').trim();
    const ten = (rawTen || '').trim();
    if (!ma || !ten) continue;
    if (!map.has(ma)) map.set(ma, ten);
  }

  const rows = [...map.entries()];
  console.log(`Đọc được ${rows.length} vật tư duy nhất, bắt đầu insert...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values = [];
      const placeholders = batch
        .map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`)
        .join(', ');
      batch.forEach(([ma, ten]) => values.push(ma, ten));

      const result = await client.query(
        `INSERT INTO VatTu (ma_vat_tu, ten_vat_tu) VALUES ${placeholders}
         ON CONFLICT (ma_vat_tu) DO NOTHING`,
        values
      );
      inserted += result.rowCount;
    }
    await client.query('COMMIT');
    console.log(`Hoàn tất. Đã thêm mới ${inserted}/${rows.length} vật tư (số còn lại đã tồn tại sẵn, bị bỏ qua).`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
