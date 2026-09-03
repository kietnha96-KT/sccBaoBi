// Import/upsert VatTu từ file CSV 4 cột: ma_vat_tu,ten_vat_tu,loai,thu_kho
//  - Dòng đầu = tên cột (bỏ qua).
//  - ten_vat_tu CÓ THỂ chứa dấu phẩy -> ma lấy cột đầu, loai/thu_kho lấy 2 cột CUỐI,
//    phần còn lại ở giữa ghép lại thành ten_vat_tu.
//  - Tự giải mã tên tiếng Việt kiểu font cũ (TCVN3/ABC) -> Unicode chuẩn (scripts/tcvn3.js).
//  - ten_vat_tu rỗng -> tạm dùng chính mã làm tên (đánh dấu ở cuối để sửa lại).
//  - Upsert theo ma_vat_tu -> chạy lại nhiều lần vẫn an toàn. Dùng --dry để xem trước.
//
// Cách dùng:
//   node scripts/import-vattu-csv.js "duong-dan/file.csv" --dry
//   node scripts/import-vattu-csv.js "duong-dan/file.csv"
//   DATABASE_URL="postgres://..." node scripts/import-vattu-csv.js "file.csv" [--dry]
require('dotenv').config();
const fs = require('fs');
const pool = require('../db');
const { tcvn3ToUnicode } = require('./tcvn3');

function parseRows(raw) {
  const lines = raw.split(/\r?\n/);
  const rows = [];
  const bad = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length < 4) {
      bad.push({ line: i + 1, raw: line });
      continue;
    }
    const ma_vat_tu = parts[0].trim();
    const thu_kho = parts[parts.length - 1].trim();
    const loai = parts[parts.length - 2].trim();
    const tenRaw = parts.slice(1, -2).join(',').trim();
    if (!ma_vat_tu) {
      bad.push({ line: i + 1, raw: line });
      continue;
    }
    const { text: ten_uni, warnings } = tcvn3ToUnicode(tenRaw);
    rows.push({
      line: i + 1,
      ma_vat_tu,
      tenRaw,
      ten_vat_tu: ten_uni,
      loai: loai || null,
      thu_kho: thu_kho || null,
      warnings,
    });
  }
  return { rows, bad };
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const filePath = args.find((a) => !a.startsWith('--'));
  if (!filePath) {
    console.error('Cách dùng: node scripts/import-vattu-csv.js <file.csv> [--dry]');
    process.exit(1);
  }

  const { rows, bad } = parseRows(fs.readFileSync(filePath, 'utf8'));
  console.log(`Đọc được ${rows.length} dòng vật tư.`);
  if (bad.length) {
    console.log(`Bỏ qua ${bad.length} dòng sai định dạng:`);
    bad.forEach((b) => console.log(`  dòng ${b.line}: "${b.raw}"`));
  }

  const emptyName = [];
  for (const r of rows) {
    if (!r.ten_vat_tu) {
      r.ten_vat_tu = r.ma_vat_tu; // placeholder
      emptyName.push(r.ma_vat_tu);
    }
  }

  console.log('--- Bảng đối chiếu (raw font cũ -> Unicode) ---');
  rows.forEach((r) => {
    console.log(`${r.ma_vat_tu} | ${r.loai || '-'} | ${r.thu_kho || '-'}`);
    console.log(`   cũ : ${r.tenRaw || '(rỗng)'}`);
    console.log(`   mới: ${r.ten_vat_tu}`);
    if (r.warnings.length) console.log(`   ⚠  ${r.warnings.join('; ')}`);
  });
  if (emptyName.length) {
    console.log(`\n⚠  ${emptyName.length} mã KHÔNG có tên trong file, tạm để tên = mã (cần sửa lại): ${emptyName.join(', ')}`);
  }
  const warnRows = rows.filter((r) => r.warnings.length);
  if (warnRows.length) {
    console.log(`⚠  ${warnRows.length} dòng còn cảnh báo khi giải mã font -> kiểm tra tay.`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    let updated = 0;
    for (const r of rows) {
      const res = await client.query(
        `INSERT INTO VatTu (ma_vat_tu, ten_vat_tu, loai, thu_kho)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (ma_vat_tu) DO UPDATE
           SET ten_vat_tu = EXCLUDED.ten_vat_tu,
               loai       = EXCLUDED.loai,
               thu_kho    = EXCLUDED.thu_kho
         RETURNING (xmax = 0) AS inserted`,
        [r.ma_vat_tu, r.ten_vat_tu, r.loai, r.thu_kho]
      );
      if (res.rows[0].inserted) inserted++;
      else updated++;
    }
    console.log('---');
    console.log(`Thêm mới: ${inserted} | Cập nhật (đã tồn tại): ${updated}`);

    if (dry) {
      await client.query('ROLLBACK');
      console.log('--- (--dry) Đã ROLLBACK, không ghi gì. ---');
    } else {
      await client.query('COMMIT');
      console.log('--- Đã COMMIT. ---');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
