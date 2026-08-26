import { useState } from 'react';
import { dashboardTheoLo } from '../api/dashboardApi';
import { listVatTu } from '../api/vattuApi';
import { downloadExcel } from '../api/client';
import { formatSoLuong, formatSoThapPhan } from '../format';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import DashboardFilterBar from '../components/DashboardFilterBar';
import Pagination from '../components/Pagination';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';
import { SEQUENTIAL_BLUE } from '../chartColors';

const emptyFilters = { tu_ngay: '', den_ngay: '', ma_vat_tu: '', la_lua_lai: 'false' };

export default function DashboardLoPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);
  const { data, loading, error } = useFetch(
    () => dashboardTheoLo({ ...cleanParams(filters), page, limit: PAGE_SIZE }),
    [filters.tu_ngay, filters.den_ngay, filters.ma_vat_tu, filters.la_lua_lai, page]
  );
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;

  function cleanParams(f) {
    const p = { la_lua_lai: f.la_lua_lai };
    if (f.tu_ngay) p.tu_ngay = f.tu_ngay;
    if (f.den_ngay) p.den_ngay = f.den_ngay;
    if (f.ma_vat_tu) p.ma_vat_tu = f.ma_vat_tu;
    return p;
  }

  function handleFilterChange(next) {
    setFilters(next);
    setPage(1);
  }

  const rows = data?.data || [];

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Dashboard năng suất / tiến độ theo lô
      </h1>
      <Alert>{error}</Alert>

      <DashboardFilterBar filters={filters} setFilters={handleFilterChange} vatTuList={vatTuList} />

      <div className="card">
        <div className="card-header">
          <h2>Tiến độ lựa theo lô</h2>
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
                  <th>Số lô</th>
                  <th>Vật tư</th>
                  <th>Ngày SX</th>
                  <th>Tiến độ (đã lựa / tổng)</th>
                  <th>Số báo cáo</th>
                  <th>Năng suất TB (8h)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const soLuong = Number(r.so_luong_lo) || 0;
                  const daLua = Number(r.da_lua) || 0;
                  const pct = soLuong > 0 ? Math.min(100, (daLua / soLuong) * 100) : 0;
                  return (
                    <tr key={r.lo_id}>
                      <td>{r.so_lo}</td>
                      <td className="wrap">
                        {r.ma_vat_tu} - {r.ten_vat_tu}
                      </td>
                      <td>{r.ngay_san_xuat ? new Date(r.ngay_san_xuat).toLocaleDateString('vi-VN') : '-'}</td>
                      <td style={{ minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#e1e0d9', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: SEQUENTIAL_BLUE, borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatSoLuong(daLua)}/{formatSoLuong(soLuong)} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      </td>
                      <td>{formatSoLuong(r.so_bao_cao)}</td>
                      <td>{formatSoThapPhan(r.nang_suat_tb)}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <Pagination pagination={data?.pagination} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
