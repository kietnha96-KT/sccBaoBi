-- Loại lỗi "đặc biệt": tong_lua của báo cáo dính nhãn này KHÔNG cộng vào "đã lựa"
-- của lô (coi như phần đó phải lựa lại), nhưng vẫn hiện tách riêng để theo dõi.
-- Thay cho cơ chế cũ so khớp tên loại lỗi bằng ILIKE '%gắn ron%' / '%cắt ty%'.
ALTER TABLE LoaiLoi ADD COLUMN IF NOT EXISTS la_loi_dac_biet BOOLEAN NOT NULL DEFAULT FALSE;

-- LƯU Ý: bản gốc còn 1 lệnh backfill 1 lần (UPDATE ... SET la_loi_dac_biet = TRUE theo tên
-- chứa "gắn ron" / "cắt ty"). Đã chạy trên prod từ trước và ĐÃ BỎ khỏi file này để chạy lại
-- file này KHÔNG đụng vào dữ liệu (cờ lỗi đặc biệt giờ do người dùng đặt, bị khóa khi đã có dữ liệu).
