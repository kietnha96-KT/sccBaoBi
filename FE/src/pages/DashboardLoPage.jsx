import { useState } from 'react';
import { dashboardTheoLo } from '../api/dashboardApi';
import { listVatTu } from '../api/vattuApi';
import { listLo } from '../api/loApi';
import { listNhaCungCap } from '../api/nhacungcapApi';
import { downloadExcel } from '../api/client';
import { formatSoLuong, formatSoThapPhan } from '../format';
import { useFetch } from '../hooks/useFetch';
import { useRowSelect } from '../hooks/useRowSelect';
import Alert from '../components/Alert';
import Pagination from '../components/Pagination';
import TruncatedText from '../components/TruncatedText';
import VatTuFilterFields from '../components/VatTuFilterFields';
import SearchableSelect from '../components/SearchableSelect';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';
import { loValue, loLabel, nccValue, nccLabel } from '../selectHelpers';
import { SEQUENTIAL_BLUE } from '../chartColors';

// Tiến độ theo lô = toàn bộ lịch sử của lô (KHÔNG lọc ngày, giống Báo công / Sản lượng),
// chỉ báo cáo lựa chính.
const emptyFilters = { ma_vat_tu: '', lo_id: '', ma_ncc: '' };

export default function DashboardLoPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);
  const { getRowProps } = useRowSelect();
  const { data, loading, error } = useFetch(
    () => dashboardTheoLo({ ...cleanParams(filters), page, limit: PAGE_SIZE }),
    [filters.ma_vat_tu, filters.lo_id, filters.ma_ncc, page]
  );
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const { data: loData } = useFetch(() => listLo({ limit: ALL_LIMIT }), []);
  const { data: nccData } = useFetch(() => listNhaCungCap({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  const nccList = nccData?.data || [];
  const loList = filters.ma_vat_tu
    ? (loData?.data || []).filter((l) => l.ma_vat_tu === filters.ma_vat_tu)
    : loData?.data || [];

  function cleanParams(f) {
    const p = {};
    if (f.ma_vat_tu) p.ma_vat_tu = f.ma_vat_tu;
    if (f.lo_id) p.lo_id = f.lo_id;
    if (f.ma_ncc) p.ma_ncc = f.ma_ncc;
    return p;
  }

  function handleFilterChange(next) {
    setFilters(next);
    setPage(1);
  }

  function handleVatTuChange(v) {
    const loConHopLe = !v || !filters.lo_id || (loData?.data || []).some(
      (l) => String(l.id) === String(filters.lo_id) && l.ma_vat_tu === v
    );
    handleFilterChange({ ...filters, ma_vat_tu: v, lo_id: loConHopLe ? filters.lo_id : '' });
  }

  const rows = data?.data || [];

  return (
    <div>
      <h1 className="page-title">
        Dashboard năng suất / tiến độ theo lô
      </h1>
      <Alert>{error}</Alert>

      <div className="filter-bar">
        <VatTuFilterFields vatTuList={vatTuList} value={filters.ma_vat_tu} onChange={handleVatTuChange} />
        <div className="field field-md">
          <label>Số lô</label>
          <SearchableSelect
            options={loList}
            getValue={loValue}
            getLabel={loLabel}
            value={filters.lo_id}
            onChange={(v) => handleFilterChange({ ...filters, lo_id: v })}
            placeholder="Gõ số lô..."
          />
        </div>
        <div className="field field-md">
          <label>Nhà cung cấp</label>
          <SearchableSelect
            options={nccList}
            getValue={nccValue}
            getLabel={nccLabel}
            value={filters.ma_ncc}
            onChange={(v) => handleFilterChange({ ...filters, ma_ncc: v })}
            placeholder="Gõ để tìm..."
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>
            Tiến độ lựa theo lô
            <span className="field-hint h2-note">(toàn bộ lịch sử lô · chỉ lựa chính)</span>
          </h2>
          <button
            className="btn btn-sm"
            onClick={() => downloadExcel('/dashboard/lo/export', cleanParams(filters), 'dashboard_theo_lo.xlsx')}
          >
            Xuất Excel
          </button>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã vật tư</th>
                  <th>Tên vật tư</th>
                  <th>Số lô</th>
                  {/* <th>Ngày SX</th> */}
                  <th>Nhà cung cấp</th>
                  <th>Tiến độ (đã lựa / tổng · còn lại)</th>
                  <th>Số báo cáo</th>
                  <th>Năng suất TB (8h)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const soLuong = Number(r.so_luong_lo) || 0;
                  const daLua = Number(r.da_lua) || 0;
                  const conLai = Number(r.con_lai) || 0;
                  const pct = soLuong > 0 ? Math.min(100, (daLua / soLuong) * 100) : 0;
                  const xong = soLuong > 0 && conLai <= 0;
                  // gần xong (>=90%) -> cam đậm; xong -> xanh lá; còn lại -> xanh dương
                  const barColor = xong ? 'var(--success)' : pct >= 90 ? 'var(--warning)' : SEQUENTIAL_BLUE;
                  return (
                    <tr key={r.lo_id} {...getRowProps(r.lo_id)}>
                      <td>{r.ma_vat_tu}</td>
                      <td><TruncatedText text={r.ten_vat_tu} /></td>
                      <td>{r.so_lo}</td>
                      {/* <td>{r.ngay_san_xuat ? new Date(r.ngay_san_xuat).toLocaleDateString('vi-VN') : '-'}</td> */}
                      <td><TruncatedText text={r.ten_ncc} fallback={<span className="field-hint">Chưa có</span>} /></td>
                      <td className="progress-cell">
                        <div className="progress-row">
                          <div className="progress-track">
                            <div className="progress-fill" style={{ '--fill': `${pct}%`, '--bar': barColor }} />
                          </div>
                          <span className="progress-pct" style={{ '--bar': barColor }}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="progress-nums">
                          <strong className="text-success">{formatSoLuong(daLua)}</strong>
                          <span className="text-muted"> / {soLuong > 0 ? formatSoLuong(soLuong) : '—'}</span>
                          {soLuong > 0 && (
                            <>
                              <span className="text-muted"> · </span>
                              {xong ? (
                                <span className="text-success fw-600">đã đủ</span>
                              ) : (
                                <span className="text-warning fw-600">còn {formatSoLuong(conLai)}</span>
                              )}
                            </>
                          )}
                        </div>
                        {(r.da_lua_dac_biet || []).length > 0 && (
                          <div className="field-hint progress-breakdown">
                            {(r.da_lua_dac_biet || []).map((x) => (
                              <span key={x.ten_loi}>{x.ten_loi}: {formatSoLuong(x.tong)}&nbsp;&nbsp;</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{formatSoLuong(r.so_bao_cao)}</td>
                      <td>{formatSoThapPhan(r.nang_suat_tb)}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>
    </div>
  );
}
