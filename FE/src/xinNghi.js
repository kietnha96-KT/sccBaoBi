// Dùng chung cho các trang xin nghỉ + "Giờ làm trong ngày".
// Luật thật nằm ở BE/utils/xinNghi.js; phần cấu hình ở đây chỉ để form hiện đúng ô nhập.
export const LOAI_NGHI = {
  nghi_phep: { ten: 'Nghỉ phép', buLui: 0, nhieuNgay: true },
  nghi_om: { ten: 'Nghỉ ốm', buLui: 1, nhieuNgay: true },
  che_do_nu: { ten: 'Chế độ nữ (1,5 tiếng)', buLui: 0, soPhut: 90 },
  di_tre: { ten: 'Đi trễ (30 phút)', buLui: 0, soPhut: 30 },
  ve_som: { ten: 'Về sớm (30 phút)', buLui: 0, soPhut: 30 },
  quen_cham_cong: { ten: 'Quên chấm công', buLui: 1 },
};

// Nghỉ phép chỉ có 3 mức (nghỉ ốm luôn trọn ngày). phut: số phút làm việc được nghỉ.
export const PHAN_NGAY_PHEP = [
  { value: '1', ten: '1 ngày (cả ngày)' },
  { value: '0.5', ten: '0,5 ngày (4 tiếng)', phut: 240 },
  { value: '0.25', ten: '0,25 ngày (2 tiếng)', phut: 120 },
];

export const tenLoai = (loai) => LOAI_NGHI[loai]?.ten.replace(/ \(.*\)$/, '') || loai;

export const TRANG_THAI = {
  cho_duyet: { ten: 'Chờ duyệt', badge: 'badge-warning' },
  da_duyet: { ten: 'Đã duyệt', badge: 'badge-success' },
  tu_choi: { ten: 'Từ chối', badge: 'badge-danger' },
};

// "2026-11-26" -> "26/11/2026" (cắt chuỗi, không qua Date để khỏi lệch múi giờ)
export const ngayVN = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');

export const gio5 = (t) => (t ? t.slice(0, 5) : '');

export function moTaGio(don) {
  if (don.loai === 'quen_cham_cong') {
    return [don.tu_gio && `Vào ${gio5(don.tu_gio)}`, don.den_gio && `Ra ${gio5(don.den_gio)}`].filter(Boolean).join(' · ');
  }
  return don.tu_gio ? `${gio5(don.tu_gio)} - ${gio5(don.den_gio)}` : 'Cả ngày';
}
