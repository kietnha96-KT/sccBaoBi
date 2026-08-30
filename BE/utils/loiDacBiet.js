// Lỗi "đặc biệt" (gắn ron, cắt ty):
// Khi 1 báo cáo của lô được admin gán nhãn lỗi chuẩn thuộc nhóm này thì phần
// tong_lua đó KHÔNG được cộng vào "đã lựa" của lô (coi như phần đó phải lựa lại),
// nhưng vẫn hiển thị tách riêng ở cột "Đã lựa" để theo dõi.
//
// Khớp theo kiểu CHỨA chuỗi (ILIKE '%...%') vì admin đặt tên tự do,
// ví dụ danh mục thực tế đang có "Gắn ron, đếm số", "Cắt ty".
const LOI_DAC_BIET = [
  { key: 'gan_ron', col: 'da_lua_gan_ron', label: 'Gắn ron', match: '%gắn ron%' },
  { key: 'cat_ty', col: 'da_lua_cat_ty', label: 'Cắt ty', match: '%cắt ty%' },
];

// Điều kiện SQL: dòng LoaiLoi (alias ll) có phải lỗi đặc biệt không.
// Chỉ ghép từ hằng số nội bộ, không có dữ liệu người dùng.
const LL_LA_LOI_DAC_BIET = LOI_DAC_BIET.map((l) => `ll.ten_loi ILIKE '${l.match}'`).join(' OR ');

// Các cột SUM(...) FILTER tách riêng từng loại lỗi đặc biệt (dùng trong subquery gộp theo lo_id).
// Giả định subquery có: BaoCao bc  LEFT JOIN LoaiLoi ll ON ll.id = bc.loi_chuan_id
const SUM_LOI_DAC_BIET_COLS = LOI_DAC_BIET.map(
  (l) => `SUM(bc.tong_lua) FILTER (WHERE ll.ten_loi ILIKE '${l.match}') AS ${l.col}`
).join(',\n      ');

// SUM "đã lựa" chuẩn = bỏ các báo cáo dính lỗi đặc biệt (báo cáo chưa gán nhãn vẫn tính).
const SUM_DA_LUA_CHUAN = `SUM(bc.tong_lua) FILTER (WHERE ll.id IS NULL OR NOT (${LL_LA_LOI_DAC_BIET}))`;

module.exports = { LOI_DAC_BIET, LL_LA_LOI_DAC_BIET, SUM_LOI_DAC_BIET_COLS, SUM_DA_LUA_CHUAN };