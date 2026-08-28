// Xóa toàn bộ dòng trong bảng Lo có ma_vat_tu nằm trong danh sách (file text, mỗi mã 1 dòng).
//
// An toàn:
//   - Kiểm tra mã nào không có dòng nào trong Lo -> liệt kê, bỏ qua.
//   - Kiểm tra có BaoCao trỏ tới các lô sắp xóa không -> nếu có thì DỪNG (không xóa gì),
//     trừ khi truyền --cascade để xóa luôn BaoCao + BaoCao_NhanSu của các lô đó.
//   - Chạy trong 1 transaction. --dry để xem trước, không ghi gì.
//
// Cách dùng:
//   node scripts/delete-lo-by-vattu.js "duong-dan/ma.txt" --dry
//   node scripts/delete-lo-by-vattu.js "duong-dan/ma.txt"
//   DATABASE_URL="postgres://..." node scripts/delete-lo-by-vattu.js "ma.txt" [--dry] [--cascade]
require('dotenv').config();
const fs = require('fs');
const pool = require('../db');

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const cascade = args.includes('--cascade');
  const filePath = args.find((a) => !a.startsWith('--'));
  if (!filePath) {
    console.error('Cách dùng: node scripts/delete-lo-by-vattu.js <file-ma.txt> [--dry] [--cascade]');
    process.exit(1);
  }

  const codes = [
    ...new Set(
      fs
        .readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
  console.log(`Đọc được ${codes.length} mã vật tư duy nhất từ file.`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mã nào không có dòng Lo nào
    const present = await client.query(
      'SELECT DISTINCT ma_vat_tu FROM Lo WHERE ma_vat_tu = ANY($1)',
      [codes]
    );
    const presentSet = new Set(present.rows.map((r) => r.ma_vat_tu));
    const missing = codes.filter((c) => !presentSet.has(c));

    const loRows = await client.query(
      'SELECT id FROM Lo WHERE ma_vat_tu = ANY($1)',
      [codes]
    );
    const loIds = loRows.rows.map((r) => r.id);

    const bcCount = await client.query(
      'SELECT COUNT(*)::int c FROM BaoCao WHERE lo_id = ANY($1)',
      [loIds]
    );
    const bcnsCount = await client.query(
      'SELECT COUNT(*)::int c FROM BaoCao_NhanSu WHERE baocao_id IN (SELECT id FROM BaoCao WHERE lo_id = ANY($1))',
      [loIds]
    );

    console.log('---');
    console.log(`Mã có trong Lo   : ${presentSet.size}/${codes.length}`);
    console.log(`Dòng Lo sẽ xóa   : ${loIds.length}`);
    console.log(`BaoCao liên quan : ${bcCount.rows[0].c}`);
    console.log(`BaoCao_NhanSu    : ${bcnsCount.rows[0].c}`);
    if (missing.length) {
      console.log(`Mã KHÔNG có dòng Lo nào (bỏ qua): ${missing.length}`);
      console.log('  ' + missing.join(', '));
    }

    if (bcCount.rows[0].c > 0 && !cascade) {
      throw new Error(
        `Có ${bcCount.rows[0].c} báo cáo trỏ tới các lô này. Dừng lại, KHÔNG xóa gì. ` +
          `Chạy lại kèm --cascade nếu muốn xóa luôn BaoCao + BaoCao_NhanSu.`
      );
    }

    let delBcns = 0;
    let delBc = 0;
    if (cascade && bcCount.rows[0].c > 0) {
      const r1 = await client.query(
        'DELETE FROM BaoCao_NhanSu WHERE baocao_id IN (SELECT id FROM BaoCao WHERE lo_id = ANY($1))',
        [loIds]
      );
      delBcns = r1.rowCount;
      const r2 = await client.query('DELETE FROM BaoCao WHERE lo_id = ANY($1)', [loIds]);
      delBc = r2.rowCount;
    }

    const delLo = await client.query('DELETE FROM Lo WHERE ma_vat_tu = ANY($1)', [codes]);

    const after = await client.query('SELECT COUNT(*)::int c FROM Lo');

    console.log('---');
    console.log(`Đã xóa Lo           : ${delLo.rowCount}`);
    if (cascade) {
      console.log(`Đã xóa BaoCao       : ${delBc}`);
      console.log(`Đã xóa BaoCao_NhanSu: ${delBcns}`);
    }
    console.log(`Lo còn lại          : ${after.rows[0].c}`);

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
