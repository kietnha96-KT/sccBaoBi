
-- 1. BẢNG NHÂN SỰ (tài khoản người dùng, admin tạo, không tự đăng ký)
CREATE TABLE NhanSu (
    id          SERIAL PRIMARY KEY,
    ho_ten      VARCHAR(100) NOT NULL,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,   -- lưu bản đã hash, không lưu plain text
    vai_tro     VARCHAR(20)  NOT NULL DEFAULT 'nhan_vien'
                 CHECK (vai_tro IN ('admin', 'nhan_vien', 'thu_kho')),
                 -- thu_kho: quyen gan giong admin, nhung Quan tri danh muc chi thay Lo + Loai loi
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 2. BẢNG VẬT TƯ (danh mục vật tư)
CREATE TABLE VatTu (
    ma_vat_tu   VARCHAR(20) PRIMARY KEY,
    ten_vat_tu  VARCHAR(200) NOT NULL,
    loai        VARCHAR(100),   -- loại vật tư, text tự do, admin điền dần (có thể để trống)
    thu_kho     VARCHAR(100)    -- tên thủ kho quản lý vật tư này, chỉ hiện trong trang quản trị của admin
);

-- 2b. BẢNG NHÀ CUNG CẤP (danh mục, admin quản lý; 1 lô có thể chưa gán/gán 1 nhà cung cấp)
CREATE TABLE NhaCungCap (
    ma_ncc   VARCHAR(20) PRIMARY KEY,
    ten_ncc  VARCHAR(200) NOT NULL
);

-- 3. BẢNG LÔ (mỗi dòng = 1 lần phát sinh lô cho 1 vật tư cụ thể)
--    Lưu ý: so_lo có thể lặp giá trị giữa các dòng khác vật tư
--    (vì 1 lần phát sinh lô có thể áp dụng cho nhiều vật tư, mỗi cặp có ngày sản xuất riêng)
CREATE TABLE Lo (
    id             SERIAL PRIMARY KEY,
    so_lo          VARCHAR(50) NOT NULL,
    ma_vat_tu      VARCHAR(20) NOT NULL REFERENCES VatTu(ma_vat_tu),
    ngay_san_xuat  DATE,
    so_luong_lo    NUMERIC(12,2) NOT NULL DEFAULT 0,
    ma_ncc         VARCHAR(20) REFERENCES NhaCungCap(ma_ncc)  -- 0-1, để trống nếu admin chưa có NCC
);

CREATE INDEX idx_lo_ma_vat_tu ON Lo(ma_vat_tu);
CREATE INDEX idx_lo_so_lo ON Lo(so_lo);
CREATE INDEX idx_lo_ma_ncc ON Lo(ma_ncc);

-- 4. BẢNG DANH MỤC LỖI CHUẨN (riêng theo từng vật tư, admin quản lý)
CREATE TABLE LoaiLoi (
    id              SERIAL PRIMARY KEY,
    ma_vat_tu       VARCHAR(20) NOT NULL REFERENCES VatTu(ma_vat_tu),
    ten_loi         VARCHAR(200) NOT NULL,
    la_loi_dac_biet BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = tong_lua không cộng vào "đã lựa" của lô, hiện tách riêng
    -- mục đích dùng: 'gan_nhan' = gán nhãn lỗi chuẩn cho báo cáo (năng suất);
    -- 'tach_hu_bo' = nhập số lượng hư bỏ chi tiết trong báo cáo; 'ca_hai' = cả hai.
    muc_dich        VARCHAR(20) NOT NULL DEFAULT 'gan_nhan'
                    CHECK (muc_dich IN ('gan_nhan', 'tach_hu_bo', 'ca_hai'))
);

CREATE INDEX idx_loailoi_ma_vat_tu ON LoaiLoi(ma_vat_tu);

-- 5. BẢNG BÁO CÁO (mỗi dòng = 1 lần lựa, nhập bởi 1 người đại diện)
CREATE TABLE BaoCao (
    id              SERIAL PRIMARY KEY,
    ngay            DATE NOT NULL,
    lo_id           INTEGER NOT NULL REFERENCES Lo(id),
    dat             NUMERIC(12,2) NOT NULL DEFAULT 0,
    hu_bo           NUMERIC(12,2) NOT NULL DEFAULT 0,
    tong_lua        NUMERIC(12,2) GENERATED ALWAYS AS (dat + hu_bo) STORED, -- tự tính
    tg_bat_dau      TIME,
    tg_ket_thuc     TIME,
    nguoi_nhap_id   INTEGER NOT NULL REFERENCES NhanSu(id),  -- người đại diện nhập
    loi_nguoi_dung  VARCHAR(255),   -- text tự do người nhập ghi; sửa được khi còn quyền sửa phiếu (NV: trong ngày; admin: mọi lúc)
    loi_chuan_id    INTEGER REFERENCES LoaiLoi(id),  -- admin gán nhãn sau, để trống lúc đầu
	la_lua_lai      BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = báo cáo lựa lại, loại khỏi công thức/dashboard chính
    ghi_chu         TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_baocao_lo_id ON BaoCao(lo_id);
CREATE INDEX idx_baocao_nguoi_nhap_id ON BaoCao(nguoi_nhap_id);
CREATE INDEX idx_baocao_ngay ON BaoCao(ngay);
CREATE INDEX idx_baocao_loi_chuan_id ON BaoCao(loi_chuan_id);

-- 6. BẢNG NỐI: NHỮNG NGƯỜI CÙNG THAM GIA 1 BÁO CÁO (many-to-many)
--    Người đại diện (nguoi_nhap_id ở bảng BaoCao) cũng tự chọn tên mình vào đây
--    Dùng để tính "tổng số nhân sự làm" trong công thức năng suất
CREATE TABLE BaoCao_NhanSu (
    id          SERIAL PRIMARY KEY,
    baocao_id   INTEGER NOT NULL REFERENCES BaoCao(id),
    nhansu_id   INTEGER NOT NULL REFERENCES NhanSu(id),
    UNIQUE (baocao_id, nhansu_id)  -- không chọn trùng 1 người 2 lần trong cùng báo cáo
);

CREATE INDEX idx_baocaonhansu_baocao_id ON BaoCao_NhanSu(baocao_id);
CREATE INDEX idx_baocaonhansu_nhansu_id ON BaoCao_NhanSu(nhansu_id);

-- 7. BẢNG CON: BÓC TÁCH SỐ LƯỢNG HƯ BỎ CỦA 1 BÁO CÁO THEO TỪNG LOẠI LỖI
--    Lỗi lưu theo DÒNG, không thêm cột cho mỗi loại lỗi.
--    Tổng so_luong của 1 báo cáo <= BaoCao.hu_bo (phần chênh lệch = "chưa phân loại").
CREATE TABLE BaoCao_LoiChiTiet (
    id          SERIAL PRIMARY KEY,
    baocao_id   INTEGER NOT NULL REFERENCES BaoCao(id) ON DELETE CASCADE,
    loai_loi_id INTEGER NOT NULL REFERENCES LoaiLoi(id),
    so_luong    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (so_luong >= 0),
    UNIQUE (baocao_id, loai_loi_id)
);

CREATE INDEX idx_baocao_loichitiet_baocao_id ON BaoCao_LoiChiTiet(baocao_id);
CREATE INDEX idx_baocao_loichitiet_loai_loi_id ON BaoCao_LoiChiTiet(loai_loi_id);

-- 8. LƯU VẾT khi admin đổi mục đích 1 loại lỗi -> hệ thống dọn dữ liệu liên quan.
--    Thuần ghi lại để tra cứu + nhập lại thủ công. Không FK, không cascade, không undo.
--    loai = 'chi_tiet_hu_bo' (xóa 1 dòng BaoCao_LoiChiTiet) | 'nhan_loi_chuan' (gỡ loi_chuan_id).
CREATE TABLE BaoCao_Loi_LichSuXoa (
    id           SERIAL PRIMARY KEY,
    loai         VARCHAR(20) NOT NULL,
    baocao_id    INTEGER NOT NULL,
    lo_id        INTEGER,
    so_lo        VARCHAR(50),
    hu_bo_goc    NUMERIC(12,2),
    loai_loi_id  INTEGER,
    ten_loi      VARCHAR(200),
    so_luong     NUMERIC(12,2),
    ly_do        VARCHAR(40) NOT NULL DEFAULT 'doi_muc_dich_loai_loi',
    xoa_luc      TIMESTAMP NOT NULL DEFAULT NOW(),
    xoa_boi_id   INTEGER,
    xoa_boi_ten  VARCHAR(100)
);

CREATE INDEX idx_lichsuxoa_baocao_id ON BaoCao_Loi_LichSuXoa(baocao_id);
CREATE INDEX idx_lichsuxoa_loai_loi_id ON BaoCao_Loi_LichSuXoa(loai_loi_id);
CREATE INDEX idx_lichsuxoa_xoa_luc ON BaoCao_Loi_LichSuXoa(xoa_luc);

-- ============================================
-- GHI CHÚ CÔNG THỨC NĂNG SUẤT (dùng khi viết query dashboard):
-- Năng suất chuẩn hóa 8h = (dat + hu_bo)
--                          / (EXTRACT(EPOCH FROM (tg_ket_thuc - tg_bat_dau)) / 3600.0)
--                          / (SELECT COUNT(*) FROM BaoCao_NhanSu WHERE baocao_id = BaoCao.id)
--                          * 8
--
-- Ràng buộc "tổng tong_lua theo lo_id không vượt so_luong_lo của Lo"
-- KHÔNG thể check bằng CHECK constraint (cần cộng dồn nhiều dòng) -> xử lý ở Backend.
--
-- Kiểm tra lại: \dt  (trong psql)
-- hoặc pgAdmin > Databases > sccBaoBi > Schemas > public > Tables
-- ============================================