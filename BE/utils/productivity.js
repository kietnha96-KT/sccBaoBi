// CTE dùng chung cho mọi dashboard năng suất.
// Công thức (theo ghi chú trong taobang.sql):
// nang_suat_8h = tong_lua / gio_lam / so_nhansu_tham_gia * 8
// - gio_lam tính từ tg_bat_dau -> tg_ket_thuc (giờ)
// - so_nhansu lấy từ BaoCao_NhanSu
// - báo cáo thiếu giờ làm hoặc thiếu nhân sự thì nang_suat_8h = NULL (loại khỏi trung bình)
const BC_CALC_CTE = `
  WITH bc_calc AS (
    SELECT
      bc.*,
      (SELECT COUNT(*) FROM BaoCao_NhanSu bcns WHERE bcns.baocao_id = bc.id) AS so_nhansu,
      CASE
        WHEN bc.tg_bat_dau IS NOT NULL AND bc.tg_ket_thuc IS NOT NULL AND bc.tg_ket_thuc > bc.tg_bat_dau
        THEN EXTRACT(EPOCH FROM (bc.tg_ket_thuc - bc.tg_bat_dau)) / 3600.0
        ELSE NULL
      END AS gio_lam
    FROM BaoCao bc
  ),
  bc_nang_suat AS (
    SELECT
      *,
      CASE
        WHEN gio_lam IS NOT NULL AND gio_lam > 0 AND so_nhansu > 0
        THEN ROUND((tong_lua / gio_lam / so_nhansu * 8)::numeric, 2)
        ELSE NULL
      END AS nang_suat_8h
    FROM bc_calc
  )
`;

module.exports = { BC_CALC_CTE };
