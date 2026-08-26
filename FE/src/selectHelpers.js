// Hàm lấy value/label dùng chung cho các SearchableSelect (vật tư, lô, nhân sự...)
import { formatSoLuong } from './format';

export const vatTuValue = (v) => v.ma_vat_tu;
export const vatTuLabel = (v) => `${v.ma_vat_tu} - ${v.ten_vat_tu}`;

export const nhanSuValue = (n) => n.id;
export const nhanSuLabel = (n) => n.ho_ten;

export const loValue = (l) => l.id;
export const loLabel = (l) => `${l.so_lo} (${l.ma_vat_tu}) - còn lại ${formatSoLuong(l.con_lai)}/${formatSoLuong(l.so_luong_lo)}`;
