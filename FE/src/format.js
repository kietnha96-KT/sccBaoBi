// Định dạng số lượng (đạt, hư bỏ, tổng lựa, số lượng lô, số báo cáo...) thành số nguyên,
// có dấu phân tách nghìn theo chuẩn Việt Nam (vd 12.345). Các cột này trong DB lưu kiểu
// NUMERIC(12,2) nên pg luôn trả về dạng "62.00" dù về nghiệp vụ luôn là số nguyên.
// Không dùng hàm này cho năng suất TB hay tỷ lệ % - đó là số thập phân có ý nghĩa thật.
export function formatSoLuong(value) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (Number.isNaN(n)) return '-';
  return Math.round(n).toLocaleString('vi-VN');
}

// Định dạng số thập phân thật (năng suất TB, tỷ lệ % hư bỏ...) theo chuẩn Việt Nam:
// dấu chấm phân tách hàng nghìn, dấu phẩy phân tách phần thập phân. Nếu để nguyên
// giá trị thô (vd "1234.56") thì dấu chấm đó dễ bị nhầm với dấu chấm phân cách nghìn
// ở các cột số lượng khác trên cùng bảng.
export function formatSoThapPhan(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
