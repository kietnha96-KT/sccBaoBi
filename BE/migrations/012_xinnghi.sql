-- Kê khai xin nghỉ (ghi nhận để theo dõi, KHÔNG tính lương / chấm công).
-- Chạy lên PROD TRƯỚC khi deploy code (dashboard "Giờ làm trong ngày" đọc bảng này).
-- Luật theo loại nghỉ (giờ cố định, số lần/tháng, hạn kê) nằm ở Backend: utils/xinNghi.js.
CREATE TABLE IF NOT EXISTS XinNghi (
    id              SERIAL PRIMARY KEY,
    nhansu_id       INTEGER NOT NULL REFERENCES NhanSu(id),   -- người nghỉ
    ngay            DATE NOT NULL,                            -- 1 dòng = 1 người, 1 ngày, 1 loại
    loai            VARCHAR(20) NOT NULL
                    CHECK (loai IN ('nghi_phep', 'nghi_om', 'che_do_nu',
                                    'di_tre', 've_som', 'quen_cham_cong')),
    tu_gio          TIME,        -- nghỉ phép/ốm: trống cả hai = cả ngày; quên chấm công: giờ vào (mỗi đơn chỉ 1 trong 2 cột)
    den_gio         TIME,        -- quên chấm công: giờ ra
    ly_do           VARCHAR(255),
    nhom_id         UUID,        -- các ngày kê trong cùng 1 lần có chung mã; đơn 1 ngày để NULL
    trang_thai      VARCHAR(10) NOT NULL DEFAULT 'cho_duyet'
                    CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'tu_choi')),
    nguoi_duyet_id  INTEGER REFERENCES NhanSu(id),
    duyet_luc       TIMESTAMP,
    ghi_chu_duyet   VARCHAR(255),
    nguoi_tao_id    INTEGER NOT NULL REFERENCES NhanSu(id),   -- khác nhansu_id nếu admin kê hộ
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP,
    CHECK (tu_gio IS NULL OR den_gio IS NULL OR den_gio > tu_gio)
);

CREATE INDEX IF NOT EXISTS idx_xinnghi_nhansu_ngay ON XinNghi (nhansu_id, ngay);
CREATE INDEX IF NOT EXISTS idx_xinnghi_ngay        ON XinNghi (ngay);
CREATE INDEX IF NOT EXISTS idx_xinnghi_nhom        ON XinNghi (nhom_id);

-- Nhan su: quyen ke ho xin nghi (admin tick cho nhan vien phu trach) va gioi tinh.
ALTER TABLE NhanSu ADD COLUMN IF NOT EXISTS duoc_ke_ho BOOLEAN NOT NULL DEFAULT FALSE;
-- Co lam xu ly hang (lua): bo tick cho nguoi lam viec khac (vd boc vac), ho khong hien trong phan xu ly hang.
ALTER TABLE NhanSu ADD COLUMN IF NOT EXISTS xu_ly_hang BOOLEAN NOT NULL DEFAULT TRUE;

-- Chi gan 'nam' dung luc moi them cot, chay lai file khong de len gioi tinh da sua sau nay.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'nhansu' AND column_name = 'gioi_tinh') THEN
    ALTER TABLE NhanSu ADD COLUMN gioi_tinh VARCHAR(3) NOT NULL DEFAULT 'nu' CHECK (gioi_tinh IN ('nam', 'nu'));
    UPDATE NhanSu SET gioi_tinh = 'nam' WHERE vai_tro IN ('admin', 'thu_kho');
  END IF;
END $$;
