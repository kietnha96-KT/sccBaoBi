-- Them cot "loai" (loai vat tu, text tu do, admin dien sau) va "thu_kho" (ten thu kho quan ly vat tu do)
-- vao bang VatTu. Ca 2 cot deu cho phep NULL (chua co du lieu ngay, se cap nhat dan sau).
ALTER TABLE VatTu ADD COLUMN IF NOT EXISTS loai VARCHAR(100);
ALTER TABLE VatTu ADD COLUMN IF NOT EXISTS thu_kho VARCHAR(100);
