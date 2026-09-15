import { dashboardHuBoChiTiet } from '../api/dashboardApi';
import { formatSoLuong, formatSoThapPhan } from '../format';
import { useFetch } from '../hooks/useFetch';
import Alert from './Alert';
import TruncatedText from './TruncatedText';

// màu theo mức tỷ lệ hư bỏ (đồng bộ với trang cha)
function pctColor(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return 'var(--text-muted)';
  if (n >= 10) return 'var(--danger)';
  if (n >= 5) return 'var(--warning)';
  return 'var(--text-muted)';
}
const pctText = (v) => (v == null ? '—' : `${formatSoThapPhan(v)}%`);

// Bảng phụ: từng báo cáo của 1 lô đã bấm.
// row: dòng lô đã bấm; params: bộ lọc đã "clean" của trang.
export default function HuBoDetail({ row, params }) {
  const { data, loading, error } = useFetch(
    () => dashboardHuBoChiTiet({ ...params, lo_id: row.lo_id }),
    [row.lo_id, params.ma_vat_tu, params.ma_ncc, params.loi_chuan_id, params.thu_kho]
  );
  const list = data?.data || [];
  const theoLoi = data?.theo_loi || [];
  const tongTheoLoi = theoLoi.reduce((s, x) => s + (Number(x.so_luong) || 0), 0);

  return (
    <div>
      <dl className="detail-list mb-16">
        <dt>Số lô:</dt>
        <dd>{row.so_lo}</dd>
        <dt>Mã vật tư:</dt>
        <dd>{row.ma_vat_tu}</dd>
        <dt>Tên vật tư:</dt>
        <dd>{row.ten_vat_tu}</dd>
        <dt>Số lượng lô:</dt>
        <dd>{formatSoLuong(row.so_luong_lo)}</dd>
        <dt>Nhà cung cấp:</dt>
        <dd>{row.ten_ncc || <span className="field-hint">Chưa có</span>}</dd>
        <dt>Số báo cáo (lựa chính):</dt>
        <dd>{formatSoLuong(row.so_bao_cao)}</dd>
      </dl>

      <div className="hours-cards">
        <div className="hours-card">
          <div className="field-hint">Tổng lô</div>
          <div className="hours-value">{formatSoLuong(row.so_luong_lo)}</div>
        </div>
        <div className="hours-card">
          <div className="field-hint">Tổng hư bỏ</div>
          <div className="hours-value">{formatSoLuong(row.tong_hu_bo)}</div>
        </div>
        <div className="hours-card">
          <div className="field-hint">Tỷ lệ hư bỏ</div>
          <div className="hours-value" style={{ color: pctColor(row.ty_le_hu_bo_pct) }}>
            {pctText(row.ty_le_hu_bo_pct)}
          </div>
        </div>
      </div>

      <Alert>{error}</Alert>

      {!loading && (
        <div className="table-wrap mb-16">
          <div className="field-hint mb-8">
            Thống kê lỗi đi kèm <span className="field-hint"></span>
          </div>
          {theoLoi.length === 0 ? (
            <p className="field-hint m-0">Chưa ghi nhận lỗi chi tiết cho lô này.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Loại lỗi</th>
                  <th>Số lượng</th>
                </tr>
              </thead>
              <tbody>
                {theoLoi.map((x) => (
                  <tr key={x.loai_loi_id}>
                    <td>{x.ten_loi}</td>
                    <td>{formatSoLuong(x.so_luong)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Tổng</td>
                  <td>{formatSoLuong(tongTheoLoi)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <div className="spinner-text">Đang tải...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nhân sự tham gia</th>
                <th>Ngày</th>
                <th>Lỗi</th>
                <th>Đạt</th>
                <th>Hư bỏ</th>
                <th>Tổng lựa</th>
                <th>Tỷ lệ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td><TruncatedText text={r.nhan_su_tham_gia} maxWidth={220} /></td>
                  <td className="nowrap">{r.ngay ? new Date(r.ngay).toLocaleDateString('vi-VN') : '—'}</td>
                  <td>
                    {r.ten_loi || <span className="field-hint">—</span>}
                    {r.ten_loi && !r.da_gan_nhan && <span className="field-hint"> (chưa gán)</span>}
                    {r.la_lua_lai && <span className="badge badge-warning" style={{ marginLeft: 6 }}>Lựa lại</span>}
                  </td>
                  <td>{formatSoLuong(r.dat)}</td>
                  <td>{formatSoLuong(r.hu_bo)}</td>
                  <td>{formatSoLuong(r.tong_lua)}</td>
                  <td>
                    <strong style={{ color: pctColor(r.ty_le_hu_bo_pct) }}>{pctText(r.ty_le_hu_bo_pct)}</strong>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">Không có báo cáo</td>
                </tr>
              )}
            </tbody>
            {list.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Tổng ({formatSoLuong(row.so_bao_cao)} báo cáo)</td>
                  <td>{formatSoLuong(row.tong_dat)}</td>
                  <td>{formatSoLuong(row.tong_hu_bo)}</td>
                  <td>{formatSoLuong(row.tong_lua)}</td>
                  <td style={{ color: pctColor(row.ty_le_hu_bo_pct) }}>{pctText(row.ty_le_hu_bo_pct)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
