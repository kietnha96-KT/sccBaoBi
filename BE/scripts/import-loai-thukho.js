// Import cot loai + thu_kho cho VatTu tu file Excel danh_muc_vat_tu (dung file da xuat tu app,
// dien tay cot Loai/Thu kho, roi import nguoc lai). Khop theo ma_vat_tu, khong dong nao bi tao moi.
// Cach dung (DB local, doc .env):   node scripts/import-loai-thukho.js "duong-dan-file.xlsx"
// Cach dung (DB cloud):             DATABASE_URL="..." node scripts/import-loai-thukho.js "duong-dan-file.xlsx"
require('dotenv').config();
const ExcelJS = require('exceljs');
const pool = require('../db');

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Cach dung: node scripts/import-loai-thukho.js <duong-dan-file.xlsx>');
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const ma = row.getCell(1).value;
    const loai = row.getCell(3).value;
    const thuKho = row.getCell(4).value;
    if (!ma) return;
    rows.push({
      ma: String(ma).trim(),
      loai: loai ? String(loai).trim() : null,
      thuKho: thuKho ? String(thuKho).trim() : null,
    });
  });

  console.log('So dong doc duoc tu file:', rows.length);

  let updated = 0;
  let notFound = 0;
  for (const r of rows) {
    const result = await pool.query(
      'UPDATE VatTu SET loai = $1, thu_kho = $2 WHERE ma_vat_tu = $3',
      [r.loai, r.thuKho, r.ma]
    );
    if (result.rowCount > 0) updated++;
    else notFound++;
  }

  console.log('Da cap nhat:', updated);
  console.log('Khong tim thay ma_vat_tu trong DB:', notFound);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
