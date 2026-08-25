import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardTheoVatTu, dashboardLoiTheoVatTu } from '../api/dashboardApi';
import { listLoaiLoi } from '../api/loailoiApi';
import { downloadExcel } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import DashboardFilterBar from '../components/DashboardFilterBar';
import { SEQUENTIAL_BLUE, CHART_GRID, CHART_AXIS } from '../chartColors';

const emptyFilters = { tu_ngay: '', den_ngay: '', la_lua_lai: 'false', loi_chuan_id: '' };

export default function DashboardVatTuPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const { data, loading, error } = useFetch(
    () => dashboardTheoVatTu(cleanParams(filters)),
    [filters.tu_ngay, filters.den_ngay, filters.la_lua_lai, filters.loi_chuan_id]
  );
  const { data: loiRows } = useFetch(
    () => dashboardLoiTheoVatTu({ tu_ngay: filters.tu_ngay || undefined, den_ngay: filters.den_ngay || undefined, la_lua_lai: filters.la_lua_lai }),
    [filters.tu_ngay, filters.den_ngay, filters.la_lua_lai]
  );
  const { data: loaiLoiList } = useFetch(listLoaiLoi, []);

  function cleanParams(f) {
    const p = { la_lua_lai: f.la_lua_lai };
    if (f.tu_ngay) p.tu_ngay = f.tu_ngay;
    if (f.den_ngay) p.den_ngay = f.den_ngay;
    if (f.loi_chuan_id) p.loi_chuan_id = f.loi_chuan_id;
    return p;
  }

  const rows = data || [];
  const chartData = rows
    .filter((r) => r.nang_suat_tb != null)
    .map((r) => ({ ten: r.ma_vat_tu, nang_suat: Number(r.nang_suat_tb) }));

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Dashboard năng suất theo vật tư
      </h1>
      <Alert>{error}</Alert>

      <DashboardFilterBar
        filters={filters}
        setFilters={setFilters}
        extra={
          <div className="field">
            <label>Lỗi chuẩn (admin gán)</label>
            <select value={filters.loi_chuan_id} onChange={(e) => setFilters({ ...filters, loi_chuan_id: e.target.value })}>
              <option value="">Tất cả</option>
              {loaiLoiList?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.ma_vat_tu} - {l.ten_loi}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="card">
        <div className="card-header">
          <h2>Năng suất trung bình theo vật tư (chuẩn hóa 8h)</h2>
          <button
            className="btn btn-sm"
            onClick={() => downloadExcel('/dashboard/vattu/export', cleanParams(filters), 'dashboard_theo_vat_tu.xlsx')}
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
                  <XAxis dataKey="ten" tick={{ fontSize: 12, fill: CHART_AXIS }} />
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
          <h2>Bảng chi tiết theo vật tư</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vật tư</th>
                <th>Số báo cáo</th>
                <th>Năng suất TB (8h)</th>
                <th>Tổng đạt</th>
                <th>Tổng hư bỏ</th>
                <th>Tổng lựa</th>
                <th>Tỷ lệ hư bỏ (%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ma_vat_tu}>
                  <td>
                    {r.ma_vat_tu} - {r.ten_vat_tu}
                  </td>
                  <td>{r.so_bao_cao}</td>
                  <td>{r.nang_suat_tb ?? '-'}</td>
                  <td>{r.tong_dat}</td>
                  <td>{r.tong_hu_bo}</td>
                  <td>{r.tong_lua}</td>
                  <td>{r.ty_le_hu_bo_pct ?? '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    Không có dữ liệu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h2>Breakdown lỗi theo vật tư</h2>
          <button
            className="btn btn-sm"
            onClick={() =>
              downloadExcel(
                '/dashboard/vattu/loi/export',
                { tu_ngay: filters.tu_ngay || undefined, den_ngay: filters.den_ngay || undefined, la_lua_lai: filters.la_lua_lai },
                'dashboard_loi_theo_vat_tu.xlsx'
              )
            }
          >
            Xuất Excel
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vật tư</th>
                <th>Loại lỗi</th>
                <th>Số báo cáo</th>
                <th>Tổng hư bỏ</th>
              </tr>
            </thead>
            <tbody>
              {loiRows?.map((r, i) => (
                <tr key={`${r.ma_vat_tu}-${r.loi_chuan_id}-${i}`}>
                  <td>
                    {r.ma_vat_tu} - {r.ten_vat_tu}
                  </td>
                  <td>
                    {r.ten_loi === 'Chưa gán nhãn' ? (
                      <span className="badge badge-muted">Chưa gán nhãn</span>
                    ) : (
                      r.ten_loi
                    )}
                  </td>
                  <td>{r.so_bao_cao}</td>
                  <td>{r.tong_hu_bo}</td>
                </tr>
              ))}
              {(!loiRows || loiRows.length === 0) && (
                <tr>
                  <td colSpan={4} className="empty-state">
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
