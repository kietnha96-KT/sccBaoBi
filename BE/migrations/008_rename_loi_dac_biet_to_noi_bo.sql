-- Đổi tên khái niệm "lỗi đặc biệt" -> "lỗi nội bộ": cột LoaiLoi.la_loi_dac_biet -> la_loi_noi_bo.
-- Chỉ đổi tên, dữ liệu giữ nguyên. Chạy lại nhiều lần an toàn (không làm gì nếu đã đổi).
--
-- !! THỨ TỰ DEPLOY: đây là ĐỔI TÊN cột, code cũ và code mới KHÔNG chạy được chung 1 tên cột !!
--    Giữa lúc chạy file này và lúc Render deploy xong code mới (vài phút), các trang đọc
--    LoaiLoi / Lô / báo cáo lỗi nội bộ trên prod sẽ báo lỗi 500. Nên chạy lúc ít người dùng:
--    1) Đẩy code lên main (Render build xong).
--    2) Ngay sau đó chạy file này lên PROD:
--         DATABASE_URL="postgres://..." node scripts/run-schema.js migrations/008_rename_loi_dac_biet_to_noi_bo.sql
--    (Không áp dụng quy ước #8 "migration trước deploy", vì code cũ sẽ gãy ngay khi đổi tên cột.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loailoi' AND column_name = 'la_loi_dac_biet'
  ) THEN
    ALTER TABLE LoaiLoi RENAME COLUMN la_loi_dac_biet TO la_loi_noi_bo;
  END IF;
END $$;
