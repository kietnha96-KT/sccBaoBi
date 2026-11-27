
-- 1. BẢNG NHÂN SỰ (tài khoản người dùng, admin tạo, không tự đăng ký)
CREATE TABLE NhanSu (
    id          SERIAL PRIMARY KEY,
    ho_ten      VARCHAR(100) NOT NULL,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,   -- lưu bản đã hash, không lưu plain text
    vai_tro     VARCHAR(20)  NOT NULL DEFAULT 'nhan_vien'
                 CHECK (vai_tro IN ('admin', 'nhan_vien', 'thu_kho')),
                 -- thu_kho: quyen gan giong admin, nhung Quan tri danh muc chi thay Lo + Loai loi
    created_at  TIMESTAMP DEFAULT NOW(),
    duoc_ke_ho  BOOLEAN NOT NULL DEFAULT FALSE,  -- nhân viên được kê xin nghỉ hộ (admin không cần)
    gioi_tinh   VARCHAR(3) NOT NULL DEFAULT 'nu' CHECK (gioi_tinh IN ('nam', 'nu')),
    xu_ly_hang  BOOLEAN NOT NULL DEFAULT TRUE  -- nhân viên có làm xử lý hàng (lựa); bốc vác... thì bỏ tick
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
    la_loi_noi_bo BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = tong_lua không cộng vào "đã lựa" của lô, hiện tách riêng
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

-- 8-10. VỊ TRÍ KHO (migration 009; danh mục ô sinh từ BE/data/kho-layout.json bằng
--       BE/scripts/gen-vitrikho.js -> migration 010). Logic nhập/xuất/chuyển nằm ở Backend.
-- 1. Danh mục ô vị trí. Sinh MỘT LẦN từ BE/data/kho-layout.json bằng BE/scripts/gen-vitrikho.js.
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
--    KHO ĐỘC LẬP VỚI BẢNG Lo (migration 011): lô ở kho = (ma_vat_tu, so_lo) tự lưu ở đây, KHÔNG khóa ngoại sang Lo.
--    Không có ràng buộc gì giữa SL trong kho và số lượng lô bên lựa. so_lo so khớp không phân biệt hoa/thường.
CREATE TABLE Lo_ViTri (
    id            SERIAL PRIMARY KEY,
    ma_vat_tu     VARCHAR(20) NOT NULL,           -- không FK: chỉ khi NHẬP qua API mới đối chiếu danh mục VatTu
    so_lo         VARCHAR(50) NOT NULL,
    vi_tri_id     INTEGER NOT NULL REFERENCES ViTriKho(id),
    so_luong      NUMERIC(12,2) CHECK (so_luong IS NULL OR so_luong >= 0),   -- NULL = chưa biết
    cap_nhat_luc  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_lovitri_lo_o ON Lo_ViTri (ma_vat_tu, lower(so_lo), vi_tri_id);
CREATE INDEX idx_lovitri_lo ON Lo_ViTri (ma_vat_tu, lower(so_lo));
CREATE INDEX idx_lovitri_vitri ON Lo_ViTri(vi_tri_id);

-- 3. Sổ giao dịch (chỉ thêm, không sửa): đặt vào / lấy ra / chuyển / điều chỉnh.
--    chuyen_di + chuyen_den là 2 dòng chung nhom_id (UUID) để ghép cặp một lần chuyển.
CREATE TABLE ViTri_GiaoDich (
    id                   SERIAL PRIMARY KEY,
    ma_vat_tu            VARCHAR(20) NOT NULL,    -- cùng cách nhận diện lô như Lo_ViTri, không FK sang Lo
    so_lo                VARCHAR(50) NOT NULL,
    vi_tri_id            INTEGER NOT NULL REFERENCES ViTriKho(id),
    thao_tac             VARCHAR(12) NOT NULL
                         CHECK (thao_tac IN ('nhap', 'xuat', 'chuyen_di', 'chuyen_den', 'dieu_chinh')),
    nhom_id              UUID,
    so_luong             NUMERIC(12,2) CHECK (so_luong IS NULL OR so_luong >= 0),
    nguoi_thuc_hien_id   INTEGER REFERENCES NhanSu(id),
    ghi_chu              TEXT,
    thoi_gian            TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gd_lo_text ON ViTri_GiaoDich (ma_vat_tu, lower(so_lo));
CREATE INDEX idx_gd_vitri   ON ViTri_GiaoDich(vi_tri_id);
CREATE INDEX idx_gd_nhom    ON ViTri_GiaoDich(nhom_id);
CREATE INDEX idx_gd_thoigian ON ViTri_GiaoDich(thoi_gian);

-- 11. KÊ KHAI XIN NGHỈ (migration 012). Chỉ ghi nhận để theo dõi, không tính lương / chấm công.
--     Luật theo loại (giờ cố định, số lần/tháng, hạn kê) nằm ở Backend: utils/xinNghi.js.
CREATE TABLE XinNghi (
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

CREATE INDEX idx_xinnghi_nhansu_ngay ON XinNghi (nhansu_id, ngay);
CREATE INDEX idx_xinnghi_ngay        ON XinNghi (ngay);
CREATE INDEX idx_xinnghi_nhom        ON XinNghi (nhom_id);

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