import client from './client';

// Bố cục không gian kho (x, z, xoay...) để dựng bản đồ 3D
export const getKhoLayout = () => client.get('/kho/layout').then((r) => r.data);

// Danh mục ô (+ tóm tắt hàng đang chứa). Lọc: ke, nhom, khu, tang, q, co_hang, ma_vat_tu
export const listViTri = (params) => client.get('/vi-tri', { params }).then((r) => r.data);
// Hiện trạng ô cho BẢN ĐỒ 3D: chế độ gọn (chỉ mã ô, số lô trong ô, số lô đầu - nhỏ hơn ~90% so với listViTri đầy đủ).
// BE trả mảng [ma, so_lo, lo_dau]; đổi lại thành object ngay ở đây để nơi dùng giữ nguyên { data: [{ ma_vi_tri, so_lo_trong_o, so_lo_dau }], total }.
export const listViTriBanDo = () =>
  client.get('/vi-tri', { params: { co_hang: 1, gon: 1 } }).then((r) => ({
    total: r.data.total,
    data: r.data.data.map(([ma_vi_tri, so_lo_trong_o, so_lo_dau]) => ({ ma_vi_tri, so_lo_trong_o, so_lo_dau })),
  }));
// 1 ô + các lô đang chứa
export const getViTri = (maViTri) => client.get(`/vi-tri/${encodeURIComponent(maViTri)}`).then((r) => r.data);
// Các ô mà 1 lô (mã vật tư + số lô) đang nằm: { ma_vat_tu, so_lo, data: [ô...] }. Lô ở kho độc lập với bảng Lo bên lựa.
export const getTheoLo = (maVatTu, soLo) =>
  client.get('/vi-tri/theo-lo', { params: { ma_vat_tu: maVatTu, so_lo: soLo } }).then((r) => r.data);
// Gợi ý mã ô khi gõ tìm kiếm: { data: [mã ô], total }
export const goiYViTri = (q) => client.get('/vi-tri/goi-y', { params: { q, limit: 10 } }).then((r) => r.data);
// Các lô ĐANG nằm trong kho kèm tổng SL trong kho (cộng Lo_ViTri): [{ ma_vat_tu, so_lo, so_o, tong_so_luong, co_chua_biet }]
export const listTongTheoLo = () => client.get('/vi-tri/tong-theo-lo').then((r) => r.data);
// Sổ giao dịch (phân trang)
export const listGiaoDich = (params) => client.get('/vi-tri/giao-dich', { params }).then((r) => r.data);

// Thao tác ghi (admin / thủ kho)
export const nhapViTri = (data) => client.post('/vi-tri/nhap', data).then((r) => r.data);
export const xuatViTri = (data) => client.post('/vi-tri/xuat', data).then((r) => r.data);
export const chuyenViTri = (data) => client.post('/vi-tri/chuyen', data).then((r) => r.data);
export const dieuChinhViTri = (data) => client.post('/vi-tri/dieu-chinh', data).then((r) => r.data);
