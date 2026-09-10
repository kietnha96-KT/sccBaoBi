-- Lưu vết dữ liệu bị dọn khi admin đổi mục đích 1 loại lỗi.
-- Thuần túy GHI LẠI để tra cứu và nhập lại thủ công - không FK, không cascade, không undo tự động.
--
-- 2 loại (cột "loai"):
--   'chi_tiet_hu_bo' : 1 dòng BaoCao_LoiChiTiet bị xóa (loại lỗi chuyển sang 'gan_nhan').
--                      so_luong = số nhân viên đã nhập trong form báo cáo.
--   'nhan_loi_chuan' : loi_chuan_id của 1 báo cáo bị gỡ (loại lỗi chuyển sang 'tach_hu_bo').
--                      so_luong = NULL (chỉ là nhãn, không có số lượng).
CREATE TABLE IF NOT EXISTS BaoCao_Loi_LichSuXoa (
    id           SERIAL PRIMARY KEY,
    loai         VARCHAR(20) NOT NULL,          -- 'chi_tiet_hu_bo' | 'nhan_loi_chuan'
    baocao_id    INTEGER NOT NULL,
    lo_id        INTEGER,
    so_lo        VARCHAR(50),
    hu_bo_goc    NUMERIC(12,2),                 -- hu_bo của báo cáo lúc bị dọn (ước lượng headroom khi nhập lại)
    loai_loi_id  INTEGER,
    ten_loi      VARCHAR(200),                  -- snapshot: loại lỗi có thể đổi tên / bị xóa sau
    so_luong     NUMERIC(12,2),                 -- NULL với loai = 'nhan_loi_chuan'
    ly_do        VARCHAR(40) NOT NULL DEFAULT 'doi_muc_dich_loai_loi',
    xoa_luc      TIMESTAMP NOT NULL DEFAULT NOW(),
    xoa_boi_id   INTEGER,
    xoa_boi_ten  VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_lichsuxoa_baocao_id ON BaoCao_Loi_LichSuXoa(baocao_id);
CREATE INDEX IF NOT EXISTS idx_lichsuxoa_loai_loi_id ON BaoCao_Loi_LichSuXoa(loai_loi_id);
CREATE INDEX IF NOT EXISTS idx_lichsuxoa_xoa_luc ON BaoCao_Loi_LichSuXoa(xoa_luc);
