// Import hàng loạt LÔ từ file .txt (tab-separated, có dòng tiêu đề).
// Cột trong file:  Số lô | Mã vật tư | Số lượng lô | Mã nhà cung cấp
//
// Quy tắc:
//   - Khóa ngoại lưu ĐÚNG bằng mã (ma_vat_tu, ma_ncc), không phải id -> khớp thẳng schema bảng Lo.
//   - ngay_san_xuat: luôn để NULL.
//   - Kiểm chéo với DB:
//       * ma_vat_tu KHÔNG có trong VatTu     -> TỰ TẠO bản ghi VatTu tạm (ten_vat_tu = chính mã đó),
//                                                rồi vẫn nạp dòng lô. Liệt kê ở cuối để sửa tên sau.
//       * ma_ncc   KHÔNG có trong NhaCungCap -> nạp dòng lô nhưng để ma_ncc = NULL. Liệt kê ở cuối.
//       * ma_ncc  trống                      -> ma_ncc = NULL (hợp lệ, quan hệ 0-1).
//
// Cờ:
//   --dry    : chỉ phân tích + kiểm chéo, KHÔNG ghi gì.
//   --wipe   : XÓA SẠCH bảng Lo trước khi nạp. Vì BaoCao / BaoCao_NhanSu tham chiếu tới Lo nên
//              sẽ xóa luôn 2 bảng đó (TRUNCATE ... RESTART IDENTITY CASCADE). In số dòng bị xóa.
//
// Cách dùng (DB local, đọc .env):
//   node scripts/import-lo.js "duong-dan/lo.txt" --dry
//   node scripts/import-lo.js "duong-dan/lo.txt" --wipe
require('dotenv').config();
const fs = require('fs');
const pool = require('../db');

function parseLine(line) {
  // Tách theo tab, bỏ ô rỗng do file có tab đôi giữa các cột.
  const parts = line.split('\t').map((s) => s.trim()).filter((s) => s !== '');
  if (parts.length < 3) return null;
  const [so_lo, ma_vat_tu, so_luong_raw, ma_ncc_raw] = parts;
  const so_luong = Number(String(so_luong_raw).replace(/,/g, ''));
  return {
    so_lo,
    ma_vat_tu,
    so_luong_lo: Number.isFinite(so_luong) ? so_luong : 0,
    ma_ncc: (ma_ncc_raw || '').trim() || null,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const wipe = args.includes('--wipe');
  const filePath = args.find((a) => !a.startsWith('--'));
  if (!filePath) {
    console.error('Cách dùng: node scripts/import-lo.js <duong-dan/lo.txt> [--dry] [--wipe]');
    process.exit(1);
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  const rows = [];
  const badFormat = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const r = parseLine(line);
    if (!r || !r.so_lo || !r.ma_vat_tu) {
      badFormat.push({ line: i + 1, raw: line });
      continue;
    }
    rows.push({ ...r, line: i + 1 });
  }

  console.log(`Đọc được ${rows.length} dòng lô hợp lệ về mặt định dạng.`);
  if (badFormat.length) {
    console.log(`Có ${badFormat.length} dòng sai định dạng (bỏ qua):`);
    badFormat.forEach((b) => console.log(`  dòng ${b.line}: "${b.raw}"`));
  }

  // Kiểm chéo danh mục hiện có
  const [vatTuRes, nccRes] = await Promise.all([
    pool.query('SELECT ma_vat_tu FROM VatTu'),
    pool.query('SELECT ma_ncc FROM NhaCungCap'),
  ]);
  const vatTuSet = new Set(vatTuRes.rows.map((x) => x.ma_vat_tu));
  const nccSet = new Set(nccRes.rows.map((x) => x.ma_ncc));

  const missingVatTu = new Map(); // ma_vat_tu -> số dòng
  const missingNcc = new Map();   // ma_ncc   -> số dòng

  for (const r of rows) {
    if (!vatTuSet.has(r.ma_vat_tu)) {
      missingVatTu.set(r.ma_vat_tu, (missingVatTu.get(r.ma_vat_tu) || 0) + 1);
    }
    if (r.ma_ncc && !nccSet.has(r.ma_ncc)) {
      missingNcc.set(r.ma_ncc, (missingNcc.get(r.ma_ncc) || 0) + 1);
    }
  }

  console.log('---');
  console.log(`Vật tư thiếu trong VatTu (sẽ TỰ TẠO tạm): ${missingVatTu.size} mã / ${[...missingVatTu.values()].reduce((a, b) => a + b, 0)} dòng`);
  [...missingVatTu.entries()].sort().forEach(([ma, n]) => console.log(`  ${ma}  (x${n})`));
  console.log(`NCC thiếu trong NhaCungCap (nạp lô nhưng để trống NCC): ${missingNcc.size} mã / ${[...missingNcc.values()].reduce((a, b) => a + b, 0)} dòng`);
  [...missingNcc.entries()].sort().forEach(([ma, n]) => console.log(`  ${ma}  (x${n})`));

  // Dòng để nạp: dùng ma_ncc = null nếu NCC không tồn tại
  const toInsert = rows.map((r) => ({
    so_lo: r.so_lo,
    ma_vat_tu: r.ma_vat_tu,
    so_luong_lo: r.so_luong_lo,
    ma_ncc: r.ma_ncc && nccSet.has(r.ma_ncc) ? r.ma_ncc : null,
  }));
  console.log('---');
  console.log(`Tổng số dòng lô sẽ insert: ${toInsert.length}`);

  if (dry) {
    console.log('--- (--dry) Không ghi gì vào DB. ---');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (wipe) {
      const before = await client.query(
        "SELECT (SELECT count(*) FROM Lo) lo, (SELECT count(*) FROM BaoCao) bc, (SELECT count(*) FROM BaoCao_NhanSu) bcns"
      );
      const b = before.rows[0];
      await client.query('TRUNCATE TABLE Lo, BaoCao, BaoCao_NhanSu RESTART IDENTITY CASCADE');
      console.log(`Đã xóa sạch: Lo ${b.lo} dòng, BaoCao ${b.bc} dòng, BaoCao_NhanSu ${b.bcns} dòng.`);
    }

    // Tự tạo vật tư tạm cho các mã còn thiếu
    const missingVatTuList = [...missingVatTu.keys()];
    if (missingVatTuList.length) {
      const ph = missingVatTuList.map((_, i) => `($${i + 1}, $${i + 1})`).join(', ');
      const res = await client.query(
        `INSERT INTO VatTu (ma_vat_tu, ten_vat_tu) VALUES ${ph}
         ON CONFLICT (ma_vat_tu) DO NOTHING`,
        missingVatTuList
      );
      console.log(`Đã tạo tạm ${res.rowCount} vật tư mới (ten_vat_tu = mã, cần sửa tên sau).`);
    }

    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const placeholders = batch
        .map((_, idx) => `($${idx * 4 + 1}, $${idx * 4 + 2}, NULL, $${idx * 4 + 3}, $${idx * 4 + 4})`)
        .join(', ');
      const values = [];
      batch.forEach((b) => values.push(b.so_lo, b.ma_vat_tu, b.so_luong_lo, b.ma_ncc));
      const result = await client.query(
        `INSERT INTO Lo (so_lo, ma_vat_tu, ngay_san_xuat, so_luong_lo, ma_ncc) VALUES ${placeholders}`,
        values
      );
      inserted += result.rowCount;
    }

    await client.query('COMMIT');
    console.log('---');
    console.log(`Hoàn tất. Đã thêm mới ${inserted} dòng vào bảng Lo.`);
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
