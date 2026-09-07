// Loại lỗi "đặc biệt" (cờ LoaiLoi.la_loi_dac_biet, admin tự bật ở trang Quản trị loại lỗi):
// khi 1 báo cáo LỰA CHÍNH được gán nhãn lỗi thuộc nhóm này thì phần tong_lua đó KHÔNG
// được cộng vào "đã lựa" của lô (coi như phải lựa lại), nhưng vẫn hiện tách riêng để theo dõi.
// Năng suất của báo cáo đó vẫn tính bình thường (xem utils/productivity.js - không đụng tới).
//
// LO_DA_LUA_JOIN: subquery gộp "đã lựa" theo lô, dùng CHUNG cho danh mục lô (lo.routes.js)
// và dashboard năng suất theo lô (dashboard.routes.js). Yêu cầu: query ngoài có bảng Lo alias `l`.
//   dl.da_lua          : tổng lựa CHUẨN = báo cáo lựa chính, bỏ nhóm lỗi đặc biệt
//   dl.da_lua_dac_biet : json [{ ten_loi, tong }] từng loại lỗi đặc biệt (mảng rỗng nếu không có)
// con_lai = so_luong_lo - da_lua  -> phần lỗi đặc biệt vẫn nằm trong "còn lại".
const LO_DA_LUA_JOIN = `
  LEFT JOIN (
    SELECT
      lo_id,
      SUM(tong) FILTER (WHERE dac_biet IS NOT TRUE) AS da_lua,
      COALESCE(
        json_agg(json_build_object('ten_loi', ten_loi, 'tong', tong)) FILTER (WHERE dac_biet),
        '[]'
      ) AS da_lua_dac_biet
    FROM (
      SELECT bc.lo_id, ll.ten_loi, ll.la_loi_dac_biet AS dac_biet, SUM(bc.tong_lua) AS tong
      FROM BaoCao bc
      LEFT JOIN LoaiLoi ll ON ll.id = bc.loi_chuan_id
      WHERE bc.la_lua_lai = FALSE
      GROUP BY bc.lo_id, ll.ten_loi, ll.la_loi_dac_biet
    ) g
    GROUP BY lo_id
  ) dl ON dl.lo_id = l.id
`;

// SUM "đã lựa chuẩn" trong 1 truy vấn KHÔNG có sẵn alias `l` (dùng cho kiểm tra khi sửa so_luong_lo).
// Giả định query có: BaoCao bc  LEFT JOIN LoaiLoi ll ON ll.id = bc.loi_chuan_id  AND bc.la_lua_lai = FALSE
const SUM_DA_LUA_CHUAN = `SUM(bc.tong_lua) FILTER (WHERE ll.id IS NULL OR ll.la_loi_dac_biet = FALSE)`;

// Gộp mảng da_lua_dac_biet thành 1 ô text cho file Excel: "Gắn ron: 1.200; Cắt ty: 800".
function dacBietToText(arr) {
  return (arr || [])
    .map((x) => `${x.ten_loi}: ${Math.round(Number(x.tong) || 0).toLocaleString('vi-VN')}`)
    .join('; ');
}

module.exports = { LO_DA_LUA_JOIN, SUM_DA_LUA_CHUAN, dacBietToText };
