-- Migration 011: TÁCH vị trí kho khỏi bảng Lo (phần xử lý/báo cáo lựa).
-- Trước: Lo_ViTri / ViTri_GiaoDich trỏ tới Lo(id) bằng khóa ngoại lo_id.
-- Sau  : mỗi dòng tự mang ma_vat_tu + so_lo (text), KHÔNG còn khóa ngoại sang Lo. Lô ở kho và lô ở bên lựa là
--        2 thế giới độc lập: kho nhập lô chưa khai bên lựa được, số lượng hai bên không liên quan nhau.
--        Chỉ còn quy ước chung: cùng mã vật tư + cùng số lô (bỏ qua hoa/thường, khoảng trắng đầu/cuối).
-- Dữ liệu cũ được giữ: ma_vat_tu + so_lo được chép từ Lo trước khi bỏ cột lo_id.
-- Chạy tay: node scripts/run-schema.js migrations/011_vitri_tach_khoi_lo.sql
-- PROD: chạy SAU 009 + 010 (bảng còn trống thì chạy ngay được), TRƯỚC khi deploy code mới của kho.
-- Làm trong 1 transaction: lỗi giữa chừng thì không để lại nửa vời.
BEGIN;

-- 1. Thêm cột mới (tạm cho phép NULL để chép dữ liệu cũ)
ALTER TABLE Lo_ViTri       ADD COLUMN ma_vat_tu VARCHAR(20), ADD COLUMN so_lo VARCHAR(50);
ALTER TABLE ViTri_GiaoDich ADD COLUMN ma_vat_tu VARCHAR(20), ADD COLUMN so_lo VARCHAR(50);

-- 2. Chép từ Lo (so_lo cắt khoảng trắng 2 đầu cho khớp cách kho so sánh)
UPDATE Lo_ViTri lv       SET ma_vat_tu = l.ma_vat_tu, so_lo = btrim(l.so_lo) FROM Lo l WHERE l.id = lv.lo_id;
UPDATE ViTri_GiaoDich gd SET ma_vat_tu = l.ma_vat_tu, so_lo = btrim(l.so_lo) FROM Lo l WHERE l.id = gd.lo_id;

-- 3. Bắt buộc có giá trị, rồi bỏ lo_id (kéo theo khóa ngoại, UNIQUE (lo_id, vi_tri_id) và index theo lo_id)
ALTER TABLE Lo_ViTri       ALTER COLUMN ma_vat_tu SET NOT NULL, ALTER COLUMN so_lo SET NOT NULL;
ALTER TABLE ViTri_GiaoDich ALTER COLUMN ma_vat_tu SET NOT NULL, ALTER COLUMN so_lo SET NOT NULL;
ALTER TABLE Lo_ViTri       DROP COLUMN lo_id;
ALTER TABLE ViTri_GiaoDich DROP COLUMN lo_id;

-- 4. Mỗi (vật tư, số lô, ô) chỉ 1 dòng - so_lo không phân biệt hoa/thường
CREATE UNIQUE INDEX uq_lovitri_lo_o ON Lo_ViTri (ma_vat_tu, lower(so_lo), vi_tri_id);
CREATE INDEX idx_lovitri_lo ON Lo_ViTri (ma_vat_tu, lower(so_lo));
CREATE INDEX idx_gd_lo_text ON ViTri_GiaoDich (ma_vat_tu, lower(so_lo));

COMMIT;
