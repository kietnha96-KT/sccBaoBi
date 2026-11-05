import { formatSoLuong } from './format';

// Backend trả lỗi nghiệp vụ kèm { code, details } (số liệu thô) để FE tự ghép câu thông báo và
// định dạng số (dấu chấm hàng nghìn) bằng formatSoLuong - giống mọi chỗ khác trên giao diện.
// Trả về chuỗi, hoặc null nếu không có code / code lạ -> getErrorMessage dùng data.message của BE.
export function buildErrorMessage(data) {
  const d = data?.details;
  if (!data?.code || !d) return null;

  switch (data.code) {
    case 'VUOT_SO_LUONG_LO': {
      const soLieu = `${formatSoLuong(d.da_xu_ly)}/${formatSoLuong(d.so_luong_lo)}, chỉ còn lại ${formatSoLuong(d.con_lai)}`;
      if (d.doi_nhan) {
        const ai = d.noi_bo ? `"${d.ten_loi}" đã xử lý` : 'Đã lựa';
        return `Vượt số lượng lô, không thể đổi nhãn. ${ai} ${soLieu}. Hãy xem lại các số liệu đã báo cáo.`;
      }
      return d.noi_bo
        ? `Vượt quá số lượng lô cho lỗi "${d.ten_loi}". Đã xử lý ${soLieu}.`
        : `Vượt quá số lượng lô cho phép. Đã lựa ${soLieu}.`;
    }
    case 'SO_LUONG_LO_THAP_HON_DA_LUA':
      return `Số lượng lô (${formatSoLuong(d.so_luong_lo)}) không được nhỏ hơn số đã lựa hiện tại (${formatSoLuong(d.da_lua)})`;
    case 'SO_LUONG_LO_THAP_HON_NOI_BO':
      return `Số lượng lô (${formatSoLuong(d.so_luong_lo)}) không được nhỏ hơn số đã xử lý của lỗi nội bộ "${d.ten_loi}" (${formatSoLuong(d.da_xu_ly)})`;
    default:
      return null;
  }
}
