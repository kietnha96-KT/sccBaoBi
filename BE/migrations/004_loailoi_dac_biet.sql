-- Loại lỗi "đặc biệt": tong_lua của báo cáo dính nhãn này KHÔNG cộng vào "đã lựa"
-- của lô (coi như phần đó phải lựa lại), nhưng vẫn hiện tách riêng để theo dõi.
-- Thay cho cơ chế cũ so khớp tên loại lỗi bằng ILIKE '%gắn ron%' / '%cắt ty%'.
ALTER TABLE LoaiLoi ADD COLUMN IF NOT EXISTS la_loi_dac_biet BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill 1 lần cuối bằng chính quy tắc cũ -> giữ nguyên hành vi hiện tại.
UPDATE LoaiLoi
SET la_loi_dac_biet = TRUE
WHERE ten_loi ILIKE '%gắn ron%' OR ten_loi ILIKE '%cắt ty%';
