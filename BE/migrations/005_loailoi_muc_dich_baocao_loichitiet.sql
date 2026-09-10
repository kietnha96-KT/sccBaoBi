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

-- 3) Dọn nhãn lỗi chuẩn cũ: loại lỗi 'tach_hu_bo' không còn là nhãn hợp lệ nên
--    gỡ khỏi mọi báo cáo đang trỏ tới (dropdown "gắn lỗi chuẩn" cũng ẩn nó).
UPDATE BaoCao
SET loi_chuan_id = NULL
WHERE loi_chuan_id IN (SELECT id FROM LoaiLoi WHERE muc_dich = 'tach_hu_bo');

-- 4) Lỗi đặc biệt là thao tác nội bộ, báo cáo gọi đích danh, và cơ chế loại khỏi tổng
--    lô chạy theo nhãn lỗi chuẩn -> khóa muc_dich = 'gan_nhan'.
UPDATE LoaiLoi SET muc_dich = 'gan_nhan' WHERE la_loi_dac_biet = TRUE AND muc_dich <> 'gan_nhan';

-- 5) Dòng hư bỏ chi tiết trỏ tới loại lỗi giờ chỉ 'gan_nhan' (không còn để tách) ->
--    xóa; số lượng dồn về "chưa phân loại" (BaoCao.hu_bo không đổi).
DELETE FROM BaoCao_LoiChiTiet
WHERE loai_loi_id IN (SELECT id FROM LoaiLoi WHERE muc_dich = 'gan_nhan');
