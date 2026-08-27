import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { dashboardTheoThoiGian } from '../api/dashboardApi';
import { listVatTu } from '../api/vattuApi';
import { listNhaCungCap } from '../api/nhacungcapApi';
import { downloadExcel } from '../api/client';
import { formatSoLuong, formatSoThapPhan } from '../format';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import DashboardFilterBar from '../components/DashboardFilterBar';
import SearchableSelect from '../components/SearchableSelect';
import { ALL_LIMIT } from '../constants';
import { nccValue, nccLabel } from '../selectHelpers';
import { CATEGORICAL, SEQUENTIAL_BLUE, CHART_GRID, CHART_AXIS } from '../chartColors';

const emptyFilters = { tu_ngay: '', den_ngay: '', ma_vat_tu: '', la_lua_lai: 'false', group_by: 'ngay', ma_ncc: '' };

function formatKy(ky, groupBy) {
  const d = new Date(ky);
  if (groupBy === 'thang') return d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export default function DashboardThoiGianPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const { data, loading, error } = useFetch(
    () => dashboardTheoThoiGian(cleanParams(filters)),
    [filters.tu_ngay, filters.den_ngay, filters.ma_vat_tu, filters.la_lua_lai, filters.ma_ncc, filters.group_by]
  );
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const { data: nccData } = useFetch(() => listNhaCungCap({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  const nccList = nccData?.data || [];

  function cleanParams(f) {
    const p = { la_lua_lai: f.la_lua_lai, group_by: f.group_by };
    if (f.tu_ngay) p.tu_ngay = f.tu_ngay;
    if (f.den_ngay) p.den_ngay = f.den_ngay;
    if (f.ma_vat_tu) p.ma_vat_tu = f.ma_vat_tu;
    if (f.ma_ncc) p.ma_ncc = f.ma_ncc;
    return p;
  }

  const rows = data || [];
  const chartData = rows.map((r) => ({
    ky: formatKy(r.ky, filters.group_by),
    dat: Number(r.tong_dat),
    hu_bo: Number(r.tong_hu_bo),
    nang_suat: r.nang_suat_tb != null ? Number(r.nang_suat_tb) : null,
  }));

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Dashboard năng suất theo thời gian
      </h1>
      <Alert>{error}</Alert>

      <DashboardFilterBar
        filters={filters}
        setFilters={setFilters}
        vatTuList={vatTuList}
        extra={
          <>
            <div className="field">
              <label>Nhóm theo</label>
              <select value={filters.group_by} onChange={(e) => setFilters({ ...filters, group_by: e.target.value })}>
                <option value="ngay">Ngày</option>
                <option value="thang">Tháng</option>
              </select>
            </div>
            <div className="field" style={{ minWidth: 200 }}>
              <label>Nhà cung cấp</label>
              <SearchableSelect
                options={nccList}
                getValue={nccValue}
                getLabel={nccLabel}
                value={filters.ma_ncc}
                onChange={(v) => setFilters({ ...filters, ma_ncc: v })}
                placeholder="Gõ để tìm..."
              />
            </div>
          </>
        }
      />

      <div className="card">
        <div className="card-header">
          <h2>Sản lượng đạt / hư bỏ theo {filters.group_by === 'thang' ? 'tháng' : 'ngày'}</h2>
          <button
            className="btn btn-sm"
            onClick={() => downloadExcel('/dashboard/thoigian/export', cleanParams(filters), 'dashboard_theo_thoi_gian.xlsx')}
          >
            Xuất Excel
          </button>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : chartData.length === 0 ? (
            <div className="empty-state">Không có dữ liệu phù hợp bộ lọc</div>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="ky" tick={{ fontSize: 12, fill: CHART_AXIS }} />
                  <YAxis tick={{ fontSize: 12, fill: CHART_AXIS }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="dat" name="Đạt" stackId="tong" fill={CATEGORICAL[0]} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="hu_bo" name="Hư bỏ" stackId="tong" fill={CATEGORICAL[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h2>Xu hướng năng suất trung bình (chuẩn hóa 8h)</h2>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : chartData.length === 0 ? (
            <div className="empty-state">Không có dữ liệu phù hợp bộ lọc</div>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="ky" tick={{ fontSize: 12, fill: CHART_AXIS }} />
                  <YAxis tick={{ fontSize: 12, fill: CHART_AXIS }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="nang_suat"
                    name="Năng suất TB (8h)"
                    stroke={SEQUENTIAL_BLUE}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h2>Bảng chi tiết</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kỳ</th>
                <th>Số báo cáo</th>
                <th>Tổng đạt</th>
                <th>Tổng hư bỏ</th>
                <th>Tổng lựa</th>
                <th>Năng suất TB (8h)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{formatKy(r.ky, filters.group_by)}</td>
                  <td>{formatSoLuong(r.so_bao_cao)}</td>
                  <td>{formatSoLuong(r.tong_dat)}</td>
                  <td>{formatSoLuong(r.tong_hu_bo)}</td>
                  <td>{formatSoLuong(r.tong_lua)}</td>
                  <td>{formatSoThapPhan(r.nang_suat_tb)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    Không có dữ liệu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
