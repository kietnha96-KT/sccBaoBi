const ExcelJS = require('exceljs');

/**
 * Tạo file Excel từ danh sách cột + dữ liệu rồi gửi thẳng về response (streaming).
 * columns: [{ header: 'Tên cột', key: 'ten_cot', width: 20 }]
 * rows: mảng object, key khớp với columns[].key
 */
async function sendExcel(res, { sheetName, fileName, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName || 'Sheet1');

  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  rows.forEach((row) => sheet.addRow(row));

  sheet.columns.forEach((col) => {
    col.alignment = { vertical: 'middle' };
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(fileName)}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { sendExcel };
