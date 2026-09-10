import { dashboardTheoLoChiTiet } from '../api/dashboardApi';
import { formatSoLuong } from '../format';
import { useFetch } from '../hooks/useFetch';
import Alert from './Alert';
import TruncatedText from './TruncatedText';

// Bảng phụ: từng báo cáo lựa chính của 1 lô đã bấm (gồm cả báo cáo lỗi đặc biệt, có đánh dấu).
// row: dòng lô đã bấm ở Dashboard tiến độ theo lô.
export default function TheoLoDetail({ row }) {
  const { data, loading, error } = useFetch(
    () => dashboardTheoLoChiTiet({ lo_id: row.lo_id }),
    [row.lo_id]
  );
  const list = data?.data || [];

  const soLuong = Number(row.so_luong_lo) || 0;
  const daLua = Number(row.da_lua) || 0;
  const conLai = Number(row.con_lai) || 0;
  const pct = soLuong > 0 ? Math.min(100, (daLua / soLuong) * 100) : 0;
  const dacBiet = row.da_lua_dac_biet || [];

  return (
    <div>
      <dl className="detail-list mb-16">
        <dt>Số lô:</dt>
        <dd>{row.so_lo}</dd>
        <dt>Mã vật tư:</dt>
        <dd>{row.ma_vat_tu}</dd>
        <dt>Tên vật tư:</dt>
        <dd>{row.ten_vat_tu}</dd>
        <dt>Nhà cung cấp:</dt>
        <dd>{row.ten_ncc || <span className="field-hint">Chưa có</span>}</dd>
        <dt>Số lượng lô:</dt>
        <dd>{formatSoLuong(row.so_luong_lo)}</dd>
        <dt>Số báo cáo (lựa chính):</dt>
        <dd>{formatSoLuong(row.so_bao_cao)}</dd>
      </dl>

      <div className="hours-cards">
        <div className="hours-card">
          <div className="field-hint">Đã lựa</div>
          <div className="hours-value text-success">{formatSoLuong(daLua)}</div>
        </div>
        <div className="hours-card">
          <div className="field-hint">Còn lại</div>
          <div className="hours-value">{soLuong > 0 ? formatSoLuong(conLai) : '—'}</div>
        </div>
        <div className="hours-card">
          <div className="field-hint">Tiến độ</div>
          <div className="hours-value">{pct.toFixed(0)}%</div>
        </div>
      </div>

      {dacBiet.length > 0 && (
        <p className="field-hint mb-12">
          Lỗi đặc biệt (không tính vào "đã lựa"):{' '}
          {dacBiet.map((x, i) => (
            <span key={x.ten_loi}>
              {i > 0 && ' · '}
              {x.ten_loi}: <strong>{formatSoLuong(x.tong)}</strong>
            </span>
          ))}
        </p>
      )}

      <Alert>{error}</Alert>

      <div className="table-wrap">
        {loading ? (
          <div className="spinner-text">Đang tải...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Nhân sự tham gia</th>
                <th>Loại lỗi</th>
                <th>Đạt</th>
                <th>Hư bỏ</th>
                <th>Tổng lựa</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{r.ngay ? new Date(r.ngay).toLocaleDateString('vi-VN') : '—'}</td>
                  <td><TruncatedText text={r.nhan_su_tham_gia} maxWidth={200} /></td>
                  <td>
                    {r.ten_loi || <span className="field-hint">—</span>}
                    {r.ten_loi && !r.da_gan_nhan && <span className="field-hint"> (chưa gán)</span>}
                    {r.la_loi_dac_biet && (
                      <span className="badge badge-warning" style={{ marginLeft: 6 }}>Đặc biệt</span>
                    )}
                  </td>
                  <td>{formatSoLuong(r.dat)}</td>
                  <td>{formatSoLuong(r.hu_bo)}</td>
                  <td>{formatSoLuong(r.tong_lua)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">Không có báo cáo</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
