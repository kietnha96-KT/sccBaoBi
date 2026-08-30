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

// Mặc định cho bộ lọc "khoảng ngày" ở mọi trang: trọn tháng hiện tại theo giờ máy người dùng.
// Trả về chuỗi "YYYY-MM-DD" để gán thẳng vào <input type="date">.
export function firstDayOfThisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function lastDayOfThisMonth() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0); // ngày 0 của tháng sau = ngày cuối tháng này
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(
    last.getDate()
  ).padStart(2, '0')}`;
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