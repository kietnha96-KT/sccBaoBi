import { useState } from 'react';
import { dashboardTheoLo } from '../api/dashboardApi';
import { listVatTu } from '../api/vattuApi';
import { listNhaCungCap } from '../api/nhacungcapApi';
import { downloadExcel } from '../api/client';
import { formatSoLuong, formatSoThapPhan, firstDayOfThisMonth, lastDayOfThisMonth } from '../format';
import { useFetch } from '../hooks/useFetch';
import { useRowSelect } from '../hooks/useRowSelect';
import Alert from '../components/Alert';
import DashboardFilterBar from '../components/DashboardFilterBar';
import Pagination from '../components/Pagination';
import TruncatedText from '../components/TruncatedText';
import SearchableSelect from '../components/SearchableSelect';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';
import { nccValue, nccLabel } from '../selectHelpers';
import { SEQUENTIAL_BLUE } from '../chartColors';

const emptyFilters = {
  tu_ngay: firstDayOfThisMonth(),
  den_ngay: lastDayOfThisMonth(),
  ma_vat_tu: '',
  la_lua_lai: 'false',
  ma_ncc: '',
};

export default function DashboardLoPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);
  const { getRowProps } = useRowSelect();
  const { data, loading, error } = useFetch(
    () => dashboardTheoLo({ ...cleanParams(filters), page, limit: PAGE_SIZE }),
    [filters.tu_ngay, filters.den_ngay, filters.ma_vat_tu, filters.la_lua_lai, filters.ma_ncc, page]
  );
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const { data: nccData } = useFetch(() => listNhaCungCap({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  const nccList = nccData?.data || [];

  function cleanParams(f) {
    const p = { la_lua_lai: f.la_lua_lai };
    if (f.tu_ngay) p.tu_ngay = f.tu_ngay;
    if (f.den_ngay) p.den_ngay = f.den_ngay;
    if (f.ma_vat_tu) p.ma_vat_tu = f.ma_vat_tu;
    if (f.ma_ncc) p.ma_ncc = f.ma_ncc;
    return p;
  }

  function handleFilterChange(next) {
    setFilters(next);
    setPage(1);
  }

  const rows = data?.data || [];
  // Cột "Tiến độ / đã lựa / còn lại" luôn tính theo báo cáo LỰA CHÍNH (không đổi theo filter,
  // không lọc ngày). Khi đang lọc riêng "Lựa lại" thì con số này gây hiểu nhầm -> ẩn cột đi.
  const hideTienDo = filters.la_lua_lai === 'true';

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Dashboard năng suất / tiến độ theo lô
      </h1>
      <Alert>{error}</Alert>

      <DashboardFilterBar
        filters={filters}
        setFilters={handleFilterChange}
        vatTuList={vatTuList}
        extra={
          <div className="field" style={{ minWidth: 200 }}>
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
        }
      />

      <div className="card">
        <div className="card-header">
          <h2>
            Tiến độ lựa theo lô
            {hideTienDo && (
              <span className="field-hint" style={{ fontWeight: 400, marginLeft: 8 }}>
                (đang lọc Lựa lại — đã ẩn cột tiến độ)
              </span>
            )}
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
                  {!hideTienDo && <th>Tiến độ (đã lựa / tổng · còn lại)</th>}
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
                      {!hideTienDo && (
                      <td style={{ minWidth: 240 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#e1e0d9', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width .2s' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: barColor, whiteSpace: 'nowrap' }}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div style={{ fontSize: 12, marginTop: 3, whiteSpace: 'nowrap' }}>
                          <strong style={{ color: 'var(--success)' }}>{formatSoLuong(daLua)}</strong>
                          <span style={{ color: 'var(--text-muted)' }}> / {soLuong > 0 ? formatSoLuong(soLuong) : '—'}</span>
                          {soLuong > 0 && (
                            <>
                              <span style={{ color: 'var(--text-muted)' }}> · </span>
                              {xong ? (
                                <span style={{ color: 'var(--success)', fontWeight: 600 }}>đã đủ</span>
                              ) : (
                                <span style={{ color: 'var(--warning)', fontWeight: 600 }}>còn {formatSoLuong(conLai)}</span>
                              )}
                            </>
                          )}
                        </div>
                        {(r.da_lua_dac_biet || []).length > 0 && (
                          <div className="field-hint" style={{ fontSize: 11, marginTop: 2 }}>
                            {(r.da_lua_dac_biet || []).map((x) => (
                              <span key={x.ten_loi}>{x.ten_loi}: {formatSoLuong(x.tong)}&nbsp;&nbsp;</span>
                            ))}
                          </div>
                        )}
                      </td>
                      )}
                      <td>{formatSoLuong(r.so_bao_cao)}</td>
                      <td>{formatSoThapPhan(r.nang_suat_tb)}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={hideTienDo ? 6 : 7} className="empty-state">
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
