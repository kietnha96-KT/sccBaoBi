// CTE dùng chung cho mọi dashboard năng suất.
//
// Công thức (theo ghi chú trong taobang.sql):
//   nang_suat_8h = tong_lua / gio_lam / so_nhansu_tham_gia * 8
//   - tong_lua : tổng số cái đã lựa trong báo cáo (dat + hu_bo)
//   - gio_lam  : số giờ làm thực tế, tính từ tg_bat_dau -> tg_ket_thuc, TRỪ giờ nghỉ trưa
//                (xem GIO_NGHI_TRUA_* bên dưới). Chỉ trong CÙNG một ngày, không hỗ trợ ca qua đêm.
//   - so_nhansu: số người cùng tham gia báo cáo (lấy từ BaoCao_NhanSu). Năng suất được
//                CHIA ĐỀU cho tất cả người tham gia -> mỗi người tính cùng một con số.
//   - * 8      : quy về ca chuẩn 8 giờ.
//   - báo cáo thiếu giờ làm / thiếu nhân sự / giờ làm sau khi trừ nghỉ trưa <= 0
//     -> nang_suat_8h = NULL (bị loại khỏi trung bình).
//
// KHÔNG làm tròn nang_suat_8h ở mức từng báo cáo. Việc làm tròn chỉ thực hiện 1 lần ở
// bước cuối của mỗi query dashboard: ROUND(AVG(nang_suat_8h), 2). Làm tròn sớm ở từng
// dòng rồi mới lấy trung bình sẽ gây lệch nhỏ không cần thiết.
//
// Điều kiện tg_ket_thuc > tg_bat_dau ở đây là lớp phòng vệ cuối: dữ liệu nhập mới đã được
// validate ở parseReportBody (baocao.routes.js), nhưng vẫn có thể còn báo cáo cũ nhập giờ sai.

// Khoảng nghỉ trưa không tính vào giờ làm. Nếu khoảng [tg_bat_dau, tg_ket_thuc] mà người
// dùng kê có phần nằm trong khoảng này thì phần giao đó bị trừ ra khỏi gio_lam.
// Ví dụ: kê 08:00 -> 17:00  => giờ thô 9h, trừ nghỉ trưa 1h => gio_lam = 8h.
//        kê 12:00 -> 13:00  => giờ thô 1h, phần giao nghỉ trưa là 12:00->12:30 (0.5h) => gio_lam = 0.5h.
//        kê 13:00 -> 15:00  => không giao nghỉ trưa => gio_lam = 2h.
const GIO_NGHI_TRUA_BAT_DAU = '11:30';
const GIO_NGHI_TRUA_KET_THUC = '12:30';

const BC_CALC_CTE = `
  WITH bc_calc AS (
    SELECT
      bc.*,
      (SELECT COUNT(*) FROM BaoCao_NhanSu bcns WHERE bcns.baocao_id = bc.id) AS so_nhansu,
      CASE
        WHEN bc.tg_bat_dau IS NOT NULL AND bc.tg_ket_thuc IS NOT NULL AND bc.tg_ket_thuc > bc.tg_bat_dau
        THEN (
          -- tổng giây làm việc thô
          EXTRACT(EPOCH FROM (bc.tg_ket_thuc - bc.tg_bat_dau))
          -- trừ phần giao với khoảng nghỉ trưa (GREATEST(0, ...) để bỏ qua khi không giao)
          - GREATEST(
              0,
              EXTRACT(EPOCH FROM (
                LEAST(bc.tg_ket_thuc, TIME '${GIO_NGHI_TRUA_KET_THUC}')
                - GREATEST(bc.tg_bat_dau, TIME '${GIO_NGHI_TRUA_BAT_DAU}')
              ))
            )
        ) / 3600.0
        ELSE NULL
      END AS gio_lam
    FROM BaoCao bc
  ),
  bc_nang_suat AS (
    SELECT
      *,
      CASE
        WHEN gio_lam IS NOT NULL AND gio_lam > 0 AND so_nhansu > 0
        THEN (tong_lua / gio_lam / so_nhansu * 8)::numeric
        ELSE NULL
      END AS nang_suat_8h
    FROM bc_calc
  )
`;

module.exports = { BC_CALC_CTE };