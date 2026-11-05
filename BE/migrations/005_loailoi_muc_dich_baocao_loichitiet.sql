-- Tách hư bỏ theo loại lỗi.
--
-- 1) LoaiLoi.muc_dich: mỗi loại lỗi dùng cho việc gì
--      'gan_nhan'   (mặc định) - chỉ để gán nhãn lỗi chuẩn cho báo cáo (phân tích năng suất)
--      'tach_hu_bo'            - chỉ để nhập số lượng hư bỏ chi tiết trong báo cáo
--      'ca_hai'               - dùng cho cả hai
--    Dòng cũ mặc định 'gan_nhan' -> dropdown "gắn lỗi chuẩn" không đổi, không mã nào có
--    lỗi tách -> form nhập báo cáo cũng không đổi. Bản này "nằm im" tới khi admin đổi mục đích.
ALTER TABLE LoaiLoi ADD COLUMN IF NOT EXISTS muc_dich VARCHAR(20) NOT NULL DEFAULT 'gan_nhan';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'loailoi' AND constraint_name = 'loailoi_muc_dich_chk'
  ) THEN
    ALTER TABLE LoaiLoi ADD CONSTRAINT loailoi_muc_dich_chk
      CHECK (muc_dich IN ('gan_nhan', 'tach_hu_bo', 'ca_hai'));
  END IF;
END $$;

-- 2) Bảng con: bóc tách số lượng hư bỏ của 1 báo cáo theo từng loại lỗi.
--    Tổng so_luong của 1 báo cáo <= BaoCao.hu_bo (phần chênh lệch = "chưa phân loại").
--    Lỗi lưu theo DÒNG (baocao_id, loai_loi_id, so_luong) - không thêm cột cho mỗi loại lỗi.
CREATE TABLE IF NOT EXISTS BaoCao_LoiChiTiet (
    id          SERIAL PRIMARY KEY,
    baocao_id   INTEGER NOT NULL REFERENCES BaoCao(id) ON DELETE CASCADE,
    loai_loi_id INTEGER NOT NULL REFERENCES LoaiLoi(id),
    so_luong    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (so_luong >= 0),
    UNIQUE (baocao_id, loai_loi_id)
);

CREATE INDEX IF NOT EXISTS idx_baocao_loichitiet_baocao_id ON BaoCao_LoiChiTiet(baocao_id);
CREATE INDEX IF NOT EXISTS idx_baocao_loichitiet_loai_loi_id ON BaoCao_LoiChiTiet(loai_loi_id);

-- LƯU Ý: bản gốc còn 3 bước dọn dữ liệu 1 lần ngay sau đây (gỡ nhãn lỗi chuẩn của loại 'tach_hu_bo',
-- ép lỗi đặc biệt về muc_dich = 'gan_nhan', xóa dòng hư bỏ chi tiết của loại 'gan_nhan').
-- Đã chạy trên prod từ trước và ĐÃ BỎ khỏi file này để chạy lại file này KHÔNG đụng vào dữ liệu.
-- Giờ loại lỗi đã có dữ liệu thì bị khóa mục đích (BE từ chối đổi), không còn tự dọn dữ liệu.
