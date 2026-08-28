-- Them vai tro 'thu_kho' vao bang NhanSu.
-- Thu kho co quyen gan giong admin (dashboard + bao cao), nhung phan "Quan tri danh muc"
-- chi thay Lo va Loai loi (khong thay Vat tu / Nhan su / Nha cung cap).
ALTER TABLE NhanSu DROP CONSTRAINT IF EXISTS nhansu_vai_tro_check;
ALTER TABLE NhanSu ADD CONSTRAINT nhansu_vai_tro_check
  CHECK (vai_tro IN ('admin', 'nhan_vien', 'thu_kho'));
