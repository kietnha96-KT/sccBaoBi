import { formatSoLuong, formatSoThapPhan } from '../format';
import { useAuth } from '../hooks/useAuth';

// Xem 1 báo cáo ở dạng CHỈ ĐỌC. Nhận thẳng object dòng từ danh sách (đã đủ dữ liệu,
// không cần gọi API). Không có ô nhập, không nút thao tác - ai cũng xem được, mọi lúc.
export default function BaoCaoDetail({ baoCao: bc }) {
  const { isStaff } = useAuth();

  if (!bc) return null;

  const gio =
    bc.tg_bat_dau && bc.tg_ket_thuc
      ? `${bc.tg_bat_dau.substring(0, 5)} – ${bc.tg_ket_thuc.substring(0, 5)}`
      : '—';
  const nhanSu = (bc.nhansu_tham_gia || []).map((n) => n.ho_ten).join(', ') || '—';

  return (
    <dl className="detail-list">
      <dt>Ngày lựa:</dt>
      <dd>{bc.ngay ? new Date(bc.ngay).toLocaleDateString('vi-VN') : '—'}</dd>

      <dt>Vật tư:</dt>
      <dd>
        {bc.ma_vat_tu}
        {bc.ten_vat_tu ? ` — ${bc.ten_vat_tu}` : ''}
      </dd>

      <dt>Số lô:</dt>
      <dd>{bc.so_lo || '—'}</dd>

      {bc.so_luong_lo != null && (
        <>
          <dt>Số lượng lô:</dt>
          <dd>{formatSoLuong(bc.so_luong_lo)}</dd>
        </>
      )}

      <dt>Đạt:</dt>
      <dd>{formatSoLuong(bc.dat)}</dd>

      <dt>Hư bỏ:</dt>
      <dd>{formatSoLuong(bc.hu_bo)}</dd>

      <dt>Tổng lựa:</dt>
      <dd>
        <strong>{formatSoLuong(bc.tong_lua)}</strong>
      </dd>

      <dt>Giờ làm:</dt>
      <dd>{gio}</dd>

      <dt>Năng suất (quy 8h):</dt>
      <dd>
        {bc.nang_suat_8h != null ? (
          <strong>{formatSoThapPhan(bc.nang_suat_8h)}</strong>
        ) : (
          <span className="field-hint">Không tính được (thiếu giờ làm / nhân sự)</span>
        )}
      </dd>

      <dt>Loại báo cáo:</dt>
      <dd>
        {bc.la_lua_lai ? (
          <span className="badge badge-warning">Lựa lại</span>
        ) : (
          <span className="badge badge-muted">Lựa chính</span>
        )}
      </dd>

      <dt>Lỗi (tự do):</dt>
      <dd>{bc.loi_nguoi_dung || '—'}</dd>

      {isStaff && (
        <>
          <dt>Lỗi chuẩn (đã gán):</dt>
          <dd>{bc.loi_chuan_ten || <span className="field-hint">Chưa gán</span>}</dd>
        </>
      )}

      <dt>Người nhập:</dt>
      <dd>{bc.nguoi_nhap_ho_ten || '—'}</dd>

      <dt>Nhân sự tham gia:</dt>
      <dd>{nhanSu}</dd>

      <dt>Ghi chú:</dt>
      <dd style={{ whiteSpace: 'pre-wrap' }}>{bc.ghi_chu || ' '}</dd>

      <dt>Tạo lúc:</dt>
      <dd>{bc.created_at ? new Date(bc.created_at).toLocaleString('vi-VN') : '—'}</dd>
    </dl>
  );
}
