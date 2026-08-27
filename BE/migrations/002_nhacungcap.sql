-- Bảng danh mục Nhà cung cấp (admin quản lý), link 0-1 với Lô: 1 lô có thể chưa có/có 1 nhà cung cấp.
CREATE TABLE NhaCungCap (
    ma_ncc   VARCHAR(20) PRIMARY KEY,
    ten_ncc  VARCHAR(200) NOT NULL
);

ALTER TABLE Lo ADD COLUMN ma_ncc VARCHAR(20) REFERENCES NhaCungCap(ma_ncc);
CREATE INDEX idx_lo_ma_ncc ON Lo(ma_ncc);
