// Xử lý 75 mã vật tư tạo tạm khi nạp lô (chưa khai loại / thủ kho).
// Theo yêu cầu:
//   - Nhóm VA: SET loai='VA',  thu_kho='HOA'
//   - Nhóm VB: SET loai='VB',  thu_kho='PHUONG'
//   - Nhóm còn lại (PL, VE, VH, VQ): XÓA hẳn — xóa lô liên quan, LoaiLoi liên quan, rồi xóa vật tư.
//
// An toàn:
//   - Danh sách mã cố định bên dưới (đúng 75 mã trong báo cáo rà soát).
//   - Khi xóa VatTu chỉ xóa dòng còn "tạm" (loai IS NULL AND thu_kho IS NULL) -> không đụng vật tư thật.
//   - Chạy trong 1 transaction. Thêm --dry để xem trước.
//
// Cách dùng:
//   node scripts/fix-vattu-khaibao.js --dry
//   node scripts/fix-vattu-khaibao.js
//   DATABASE_URL="postgres://..." node scripts/fix-vattu-khaibao.js
require('dotenv').config();
const pool = require('../db');

const VA = ['VA01045','VA01061','VA01065','VA01066','VA01067','VA01108','VA01109','VA01110','VA01111'];
const VB = ['VB00471','VB00556','VB00586','VB00599','VB00641','VB00650'];
const DEL = [
  'PL01584','PL01623','PL01859','PL01867','PL01879','PL01881','PL01882','PL01903','PL01914',
  'PL01934','PL01935','PL01936','PL01937','PL01938','PL01939','PL01940','PL01941','PL01942',
  'PL01943','PL01944','PL01945','PL01946','PL01947','PL01948','PL01949','PL01957','PL01958',
  'VE00967','VE00983','VE01007','VE01019','VE01026','VE01028','VE01039','VE01044','VE01074',
  'VH01680','VH01700','VH01709','VH01710','VH01715','VH01772','VH01805','VH01806','VH01807',
  'VH01808','VH01809','VH01872','VH01873','VH01874','VH01878','VH01879','VH01880','VH01881',
  'VH01902','VH01904','VH01910','VH01929','VH01940',
  'VQ00197',
];

async function main() {
  const dry = process.argv.includes('--dry');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const before = await client.query(
      'SELECT (SELECT count(*) FROM VatTu)::int vattu, (SELECT count(*) FROM Lo)::int lo'
    );

    // Kiểm tra không có BaoCao chặn việc xóa
    const blocked = await client.query(
      'SELECT count(*)::int c FROM BaoCao b JOIN Lo l ON l.id = b.lo_id WHERE l.ma_vat_tu = ANY($1)',
      [DEL]
    );
    if (blocked.rows[0].c > 0) {
      throw new Error(`Có ${blocked.rows[0].c} báo cáo trỏ tới lô của các mã cần xóa -> dừng, không xóa.`);
    }

    // 1) Nhóm VA
    const rVA = await client.query(
      `UPDATE VatTu SET loai='VA', thu_kho='HOA' WHERE ma_vat_tu = ANY($1) RETURNING ma_vat_tu`,
      [VA]
    );
    // 2) Nhóm VB
    const rVB = await client.query(
      `UPDATE VatTu SET loai='VB', thu_kho='PHUONG' WHERE ma_vat_tu = ANY($1) RETURNING ma_vat_tu`,
      [VB]
    );
    // 3) Nhóm còn lại -> xóa
    const dLo = await client.query('DELETE FROM Lo WHERE ma_vat_tu = ANY($1)', [DEL]);
    const dLL = await client.query('DELETE FROM LoaiLoi WHERE ma_vat_tu = ANY($1)', [DEL]);
    const dVT = await client.query(
      `DELETE FROM VatTu
       WHERE ma_vat_tu = ANY($1)
         AND NULLIF(TRIM(COALESCE(loai,'')),'') IS NULL
         AND NULLIF(TRIM(COALESCE(thu_kho,'')),'') IS NULL`,
      [DEL]
    );

    const after = await client.query(
      'SELECT (SELECT count(*) FROM VatTu)::int vattu, (SELECT count(*) FROM Lo)::int lo'
    );

    console.log('VA  -> loai=VA,  thu_kho=HOA    :', rVA.rowCount, 'mã', rVA.rows.map((x) => x.ma_vat_tu).join(', '));
    console.log('VB  -> loai=VB,  thu_kho=PHUONG :', rVB.rowCount, 'mã', rVB.rows.map((x) => x.ma_vat_tu).join(', '));
    console.log('Xóa -> Lo        :', dLo.rowCount, 'dòng');
    console.log('Xóa -> LoaiLoi   :', dLL.rowCount, 'dòng');
    console.log('Xóa -> VatTu     :', dVT.rowCount, 'mã');
    console.log('---');
    console.log(`VatTu: ${before.rows[0].vattu} -> ${after.rows[0].vattu}`);
    console.log(`Lo   : ${before.rows[0].lo} -> ${after.rows[0].lo}`);

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
