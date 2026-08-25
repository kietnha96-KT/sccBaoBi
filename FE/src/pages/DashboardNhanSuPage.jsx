import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardTheoNhanSu } from '../api/dashboardApi';
import { listVatTu } from '../api/vattuApi';
import { downloadExcel } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import StatCard from '../components/StatCard';
import DashboardFilterBar from '../components/DashboardFilterBar';
import { SEQUENTIAL_BLUE, CHART_GRID, CHART_AXIS } from '../chartColors';

const emptyFilters = { tu_ngay: '', den_ngay: '', ma_vat_tu: '', la_lua_lai: 'false' };

export default function DashboardNhanSuPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const { data, loading, error } = useFetch(
    () => dashboardTheoNhanSu(cleanParams(filters)),
    [filters.tu_ngay, filters.den_ngay, filters.ma_vat_tu, filters.la_lua_lai]
  );
  const { data: vatTuList } = useFetch(listVatTu, []);

  function cleanParams(f) {
    const p = { la_lua_lai: f.la_lua_lai };
    if (f.tu_ngay) p.tu_ngay = f.tu_ngay;
    if (f.den_ngay) p.den_ngay = f.den_ngay;
    if (f.ma_vat_tu) p.ma_vat_tu = f.ma_vat_tu;
    return p;
  }

  const rows = data || [];
  const tongBaoCao = rows.reduce((s, r) => s + Number(r.so_bao_cao), 0);
  const soNhanSu = rows.length;
  const nangSuatCaoNhat = rows.length ? Math.max(...rows.filter((r) => r.nang_suat_tb != null).map((r) => Number(r.nang_suat_tb))) : 0;

  const chartData = rows
    .filter((r) => r.nang_suat_tb != null)
    .map((r) => ({ ten: r.ho_ten, nang_suat: Number(r.nang_suat_tb) }));

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Dashboard năng suất theo nhân sự
      </h1>
      <Alert>{error}</Alert>

      <DashboardFilterBar filters={filters} setFilters={setFilters} vatTuList={vatTuList} />

      <div className="stat-grid">
        <StatCard label="Số nhân sự" value={soNhanSu} />
        <StatCard label="Tổng số báo cáo" value={tongBaoCao} />
        <StatCard label="Năng suất cao nhất (8h)" value={nangSuatCaoNhat.toFixed(2)} />
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Năng suất trung bình theo nhân sự (chuẩn hóa 8h)</h2>
          <button
            className="btn btn-sm"
            onClick={() => downloadExcel('/dashboard/nhansu/export', cleanParams(filters), 'dashboard_theo_nhan_su.xlsx')}
          >
            Xuất Excel
          </button>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : chartData.length === 0 ? (
            <div className="empty-state">Không có dữ liệu năng suất phù hợp bộ lọc</div>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="ten" tick={{ fontSize: 12, fill: CHART_AXIS }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12, fill: CHART_AXIS }} />
                  <Tooltip formatter={(v) => [v, 'Năng suất TB']} />
                  <Bar dataKey="nang_suat" name="Năng suất TB (8h)" fill={SEQUENTIAL_BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
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
                <th>Nhân sự</th>
                <th>Số báo cáo</th>
                <th>Năng suất TB (8h)</th>
                <th>Tổng đạt</th>
                <th>Tổng hư bỏ</th>
                <th>Tổng lựa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.nhansu_id}>
                  <td>{r.ho_ten}</td>
                  <td>{r.so_bao_cao}</td>
                  <td>{r.nang_suat_tb ?? '-'}</td>
                  <td>{r.tong_dat}</td>
                  <td>{r.tong_hu_bo}</td>
                  <td>{r.tong_lua}</td>
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

