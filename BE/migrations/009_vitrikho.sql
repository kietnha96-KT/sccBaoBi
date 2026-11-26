-- Migration: vị trí kho. Chạy SAU taobang.sql (cần bảng Lo, NhanSu).
-- Nguyên tắc: DB chỉ thuần bảng, không check nghiệp vụ (chỉ số lượng không âm). Logic nhập/xuất/chuyển nằm ở Backend.

-- 1. Danh mục ô vị trí. Sinh MỘT LẦN từ kho-layout.json bằng BE/scripts/gen-vitrikho.js.
--    Bố cục không gian (x, z, xoay) KHÔNG lưu ở đây, nằm ở kho-layout.json.
CREATE TABLE ViTriKho (
    id          SERIAL PRIMARY KEY,
    ma_vi_tri   VARCHAR(30) NOT NULL UNIQUE,      -- K05-O03-T2 ; kệ sàn: S1-O03-T2-S4
    khu         VARCHAR(20),
    ke          VARCHAR(12) NOT NULL,             -- ma_ke: K01..K81, S1, S2
    loai_ke     VARCHAR(10) NOT NULL CHECK (loai_ke IN ('selective', 'san')),
    nhom        VARCHAR(50),                      -- NULL = kệ riêng; 'Drive-in 5' = kệ thuộc khối drive-in đó
    o           INTEGER NOT NULL,                 -- ô dọc theo chiều dài kệ, bắt đầu từ 1
    chieu_sau   INTEGER NOT NULL DEFAULT 1,       -- chỉ kệ sàn > 1; 1 = sát mặt lối đi
    tang        INTEGER NOT NULL,                 -- 1 = thấp nhất
    UNIQUE (ke, o, chieu_sau, tang)
);
CREATE INDEX idx_vitri_ke   ON ViTriKho(ke);
CREATE INDEX idx_vitri_nhom ON ViTriKho(nhom);

-- 2. Hiện trạng: lô nào đang nằm ở ô nào. 1 lô nhiều ô, 1 ô nhiều lô.
CREATE TABLE Lo_ViTri (
    id            SERIAL PRIMARY KEY,
    lo_id         INTEGER NOT NULL REFERENCES Lo(id),
    vi_tri_id     INTEGER NOT NULL REFERENCES ViTriKho(id),
    so_luong      NUMERIC(12,2) CHECK (so_luong IS NULL OR so_luong >= 0),   -- NULL = chưa biết
    cap_nhat_luc  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (lo_id, vi_tri_id)
);
CREATE INDEX idx_lovitri_vitri ON Lo_ViTri(vi_tri_id);

-- 3. Sổ giao dịch (chỉ thêm, không sửa): đặt vào / lấy ra / chuyển / điều chỉnh.
--    chuyen_di + chuyen_den là 2 dòng chung nhom_id (UUID) để ghép cặp một lần chuyển.
CREATE TABLE ViTri_GiaoDich (
    id                   SERIAL PRIMARY KEY,
    lo_id                INTEGER NOT NULL REFERENCES Lo(id),
    vi_tri_id            INTEGER NOT NULL REFERENCES ViTriKho(id),
    thao_tac             VARCHAR(12) NOT NULL
                         CHECK (thao_tac IN ('nhap', 'xuat', 'chuyen_di', 'chuyen_den', 'dieu_chinh')),
    nhom_id              UUID,
    so_luong             NUMERIC(12,2) CHECK (so_luong IS NULL OR so_luong >= 0),
    nguoi_thuc_hien_id   INTEGER REFERENCES NhanSu(id),
    ghi_chu              TEXT,
    thoi_gian            TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gd_lo      ON ViTri_GiaoDich(lo_id);
CREATE INDEX idx_gd_vitri   ON ViTri_GiaoDich(vi_tri_id);
CREATE INDEX idx_gd_nhom    ON ViTri_GiaoDich(nhom_id);
CREATE INDEX idx_gd_thoigian ON ViTri_GiaoDich(thoi_gian);
