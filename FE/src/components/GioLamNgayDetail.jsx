import { listBaoCao } from '../api/baocaoApi';
import { formatSoLuong } from '../format';
import { useFetch } from '../hooks/useFetch';
import { ALL_LIMIT } from '../constants';
import Alert from './Alert';
import TruncatedText from './TruncatedText';

const gioText = (t) => (t ? t.substring(0, 5) : '—');

// Bảng phụ: từng báo cáo trong ngày của 1 nhân sự đã bấm (kể cả lựa lại - xem ghi chú ở
// route BE). Dùng lại thẳng endpoint /baocao đã có, không cần API riêng.
export default function GioLamNgayDetail({ row, ngay }) {
  const { data, loading, error } = useFetch(
    () => listBaoCao({ nhansu_id: row.nhansu_id, tu_ngay: ngay, den_ngay: ngay, limit: ALL_LIMIT }),
    [row.nhansu_id, ngay]
  );
  const list = data?.data || [];

  return (
    <div>
      <dl className="detail-list mb-16">
        <dt>Nhân sự:</dt>
        <dd>{row.ho_ten}</dd>
        <dt>Ngày:</dt>
        <dd>{new Date(ngay).toLocaleDateString('vi-VN')}</dd>
        <dt>Giờ vào - giờ ra (gộp cả ngày):</dt>
        <dd>
          {row.gio_vao || row.gio_ra ? (
            <strong>
              {gioText(row.gio_vao)} - {gioText(row.gio_ra)}
            </strong>
          ) : (
            <span className="field-hint">Chưa có giờ</span>
          )}
        </dd>
        <dt>Số báo cáo:</dt>
        <dd>{formatSoLuong(row.so_bao_cao)}</dd>
      </dl>

      <p className="field-hint mb-12">
        Đây là xem nhanh theo báo cáo đã nhập, không phải chấm công chính thức.
      </p>

      <Alert>{error}</Alert>

      <div className="table-wrap">
        {loading ? (
          <div className="spinner-text">Đang tải...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Giờ làm</th>
                <th>Số lô</th>
                <th>Mã vật tư</th>
                <th>Đạt</th>
                <th>Hư bỏ</th>
                <th>Tổng lựa</th>
                <th>Lỗi</th>
                <th>Loại báo cáo</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">
                    {r.tg_bat_dau && r.tg_ket_thuc ? `${gioText(r.tg_bat_dau)} - ${gioText(r.tg_ket_thuc)}` : '—'}
                  </td>
                  <td>{r.so_lo}</td>
                  <td>{r.ma_vat_tu}</td>
                  <td>{formatSoLuong(r.dat)}</td>
                  <td>{formatSoLuong(r.hu_bo)}</td>
                  <td>{formatSoLuong(r.tong_lua)}</td>
                  <td><TruncatedText text={r.loi_nguoi_dung || '-'} maxWidth={180} /></td>
                  <td>
                    {r.la_lua_lai ? (
                      <span className="badge badge-warning">Lựa lại</span>
                    ) : (
                      <span className="badge badge-muted">Lựa chính</span>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">Không có báo cáo trong ngày này</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
