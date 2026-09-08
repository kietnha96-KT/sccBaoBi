import { formatSoLuong, formatSoThapPhan } from '../format';

// Xem chi tiết GIỜ LÀM theo người của 1 lô (chỉ đọc). Nhận thẳng object dòng từ dashboard
// báo công (đã có sẵn chi_tiet_nguoi), không gọi API.
// Xanh = giờ lỗi thường, Cam = giờ lỗi đặc biệt.
const gio = (h) => (h == null ? '—' : `${formatSoThapPhan(h, 1)}h`);

export default function BaoCongLoDetail({ lo }) {
  if (!lo) return null;
  const nguoi = lo.chi_tiet_nguoi || [];

  return (
    <div>
      <dl className="detail-list mb-16">
        <dt>Vật tư:</dt>
        <dd>{lo.ma_vat_tu}{lo.ten_vat_tu ? ` — ${lo.ten_vat_tu}` : ''}</dd>
        <dt>Số lô:</dt>
        <dd>{lo.so_lo}</dd>
        <dt>Số lượng lô:</dt>
        <dd>{formatSoLuong(lo.so_luong_lo)}</dd>
        <dt>Nhà cung cấp:</dt>
        <dd>{lo.ten_ncc || <span className="field-hint">Chưa có</span>}</dd>
        <dt>Số báo cáo (lựa chính):</dt>
        <dd>{formatSoLuong(lo.so_bao_cao)}</dd>
      </dl>

      <div className="hours-cards">
        <div className="hours-card">
          <div className="field-hint">Tổng giờ</div>
          <div className="hours-value">{gio(lo.tong_gio_lam)}</div>
        </div>
        <div className="hours-card">
          <div className="field-hint hours-label">
            <span className="legend-dot is-thuong" />
            Giờ lỗi thường
          </div>
          <div className="hours-value">{gio(lo.gio_thuong)}</div>
        </div>
        <div className="hours-card">
          <div className="field-hint hours-label">
            <span className="legend-dot is-dacbiet" />
            Giờ lỗi đặc biệt
          </div>
          <div className="hours-value text-warning">{gio(lo.gio_dac_biet)}</div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Số BC</th>
              <th className="text-blue">Giờ lỗi thường</th>
              <th className="text-warning">Giờ lỗi đặc biệt</th>
              <th>Tổng giờ</th>
            </tr>
          </thead>
          <tbody>
            {nguoi.map((p) => (
              <tr key={p.nhansu_id}>
                <td>{p.ho_ten}</td>
                <td>{formatSoLuong(p.so_bao_cao)}</td>
                <td>{Number(p.gio_thuong) > 0 ? gio(p.gio_thuong) : <span className="field-hint">—</span>}</td>
                <td>{Number(p.gio_dac_biet) > 0 ? gio(p.gio_dac_biet) : <span className="field-hint">—</span>}</td>
                <td><strong>{gio(p.gio)}</strong></td>
              </tr>
            ))}
            {nguoi.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">Không có dữ liệu giờ theo người</td>
              </tr>
            )}
          </tbody>
          {nguoi.length > 0 && (
            <tfoot>
              <tr>
                <td>Tổng</td>
                <td>{formatSoLuong(lo.so_bao_cao)}</td>
                <td className="text-blue">{gio(lo.gio_thuong)}</td>
                <td className="text-warning">{gio(lo.gio_dac_biet)}</td>
                <td>{gio(lo.tong_gio_lam)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="field-hint mt-10">
        Giờ của báo cáo làm chung được chia đều cho từng người. Chỉ tính báo cáo lựa chính.
      </p>
    </div>
  );
}
