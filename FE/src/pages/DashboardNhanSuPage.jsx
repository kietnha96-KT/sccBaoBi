import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardTheoNhanSu, dashboardNhanSuTheoVatTu } from '../api/dashboardApi';
import { listVatTu } from '../api/vattuApi';
import { listLo } from '../api/loApi';
import { listLoaiLoi } from '../api/loailoiApi';
import { listNhanSu } from '../api/nhansuApi';
import { downloadExcel } from '../api/client';
import { formatSoLuong, formatSoThapPhan } from '../format';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import StatCard from '../components/StatCard';
import DashboardFilterBar from '../components/DashboardFilterBar';
import Pagination from '../components/Pagination';
import SearchableSelect from '../components/SearchableSelect';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';
import { loValue, loLabel, nhanSuValue, nhanSuLabel } from '../selectHelpers';
import { SEQUENTIAL_BLUE, CHART_GRID, CHART_AXIS } from '../chartColors';

const emptyFilters = {
  tu_ngay: '',
  den_ngay: '',
  ma_vat_tu: '',
  lo_id: '',
  loi_chuan_id: '',
  nhansu_id: '',
  la_lua_lai: 'false',
};

export default function DashboardNhanSuPage() {
  const [page, setPage] = useState(1);
  const [breakdownPage, setBreakdownPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);
  const { data, loading, error } = useFetch(
    () => dashboardTheoNhanSu({ ...cleanParams(filters), page, limit: PAGE_SIZE }),
    [filters.tu_ngay, filters.den_ngay, filters.ma_vat_tu, filters.lo_id, filters.loi_chuan_id, filters.nhansu_id, filters.la_lua_lai, page]
  );
  const { data: breakdownData } = useFetch(
    () => dashboardNhanSuTheoVatTu({ ...cleanParams(filters), page: breakdownPage, limit: PAGE_SIZE }),
    [filters.tu_ngay, filters.den_ngay, filters.ma_vat_tu, filters.lo_id, filters.loi_chuan_id, filters.nhansu_id, filters.la_lua_lai, breakdownPage]
  );
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const { data: loData } = useFetch(() => listLo({ limit: ALL_LIMIT }), []);
  const { data: loaiLoiData } = useFetch(() => listLoaiLoi({ limit: ALL_LIMIT }), []);
  const { data: nhanSuData } = useFetch(() => listNhanSu({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  const nhanSuList = nhanSuData?.data;
  const breakdownRows = breakdownData?.data || [];
  const loList = filters.ma_vat_tu
    ? (loData?.data || []).filter((l) => l.ma_vat_tu === filters.ma_vat_tu)
    : loData?.data || [];
  // O loi chuan cung chay theo ma vat tu dang chon, giong het o so lo
  const loaiLoiList = filters.ma_vat_tu
    ? (loaiLoiData?.data || []).filter((l) => l.ma_vat_tu === filters.ma_vat_tu)
    : loaiLoiData?.data || [];

  function cleanParams(f) {
    const p = { la_lua_lai: f.la_lua_lai };
    if (f.tu_ngay) p.tu_ngay = f.tu_ngay;
    if (f.den_ngay) p.den_ngay = f.den_ngay;
    if (f.ma_vat_tu) p.ma_vat_tu = f.ma_vat_tu;
    if (f.lo_id) p.lo_id = f.lo_id;
    if (f.loi_chuan_id) p.loi_chuan_id = f.loi_chuan_id;
    if (f.nhansu_id) p.nhansu_id = f.nhansu_id;
    return p;
  }

  function handleFilterChange(next) {
    let lo_id = next.lo_id ?? filters.lo_id;
    let loi_chuan_id = next.loi_chuan_id ?? filters.loi_chuan_id;
    if (next.ma_vat_tu !== filters.ma_vat_tu) {
      // vat tu vua doi -> kiem tra lo/loi dang chon co con thuoc vat tu moi khong
      const loMoiHopLe =
        !next.ma_vat_tu ||
        !lo_id ||
        (loData?.data || []).some((l) => String(l.id) === String(lo_id) && l.ma_vat_tu === next.ma_vat_tu);
      if (!loMoiHopLe) lo_id = '';

      const loiMoiHopLe =
        !next.ma_vat_tu ||
        !loi_chuan_id ||
        (loaiLoiData?.data || []).some((l) => String(l.id) === String(loi_chuan_id) && l.ma_vat_tu === next.ma_vat_tu);
      if (!loiMoiHopLe) loi_chuan_id = '';
    }
    setFilters({ ...next, lo_id, loi_chuan_id });
    setPage(1);
    setBreakdownPage(1);
  }

  const rows = data?.data || [];
  const tongBaoCao = data?.summary?.tong_bao_cao ?? 0;
  const soNhanSu = data?.pagination?.total ?? 0;
  const nangSuatCaoNhat = data?.summary?.nang_suat_cao_nhat ?? 0;

  const chartData = rows
    .filter((r) => r.nang_suat_tb != null)
    .map((r) => ({ ten: r.ho_ten, nang_suat: Number(r.nang_suat_tb) }));

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Dashboard năng suất theo nhân sự
      </h1>
      <Alert>{error}</Alert>

      <DashboardFilterBar
        filters={filters}
        setFilters={handleFilterChange}
        vatTuList={vatTuList}
        extra={
          <>
            <div className="field" style={{ minWidth: 200 }}>
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
            <div className="field" style={{ minWidth: 200 }}>
              <label>Nhân sự</label>
              <SearchableSelect
                options={nhanSuList || []}
                getValue={nhanSuValue}
                getLabel={nhanSuLabel}
                value={filters.nhansu_id}
                onChange={(v) => handleFilterChange({ ...filters, nhansu_id: v })}
                placeholder="Gõ tên nhân sự..."
              />
            </div>
            <div className="field">
              <label>Loại lỗi</label>
              <select
                value={filters.loi_chuan_id}
                onChange={(e) => handleFilterChange({ ...filters, loi_chuan_id: e.target.value })}
              >
                <option value="">Tất cả</option>
                {loaiLoiList?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.ma_vat_tu} - {l.ten_loi}
                  </option>
                ))}
              </select>
            </div>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard label="Số nhân sự" value={formatSoLuong(soNhanSu)} />
        <StatCard label="Tổng số báo cáo" value={formatSoLuong(tongBaoCao)} />
        <StatCard label="Năng suất cao nhất (8h)" value={formatSoThapPhan(nangSuatCaoNhat)} />
      </div>

      <div className="card">
        <div className="card-header">
          <h2>
            Năng suất trung bình theo nhân sự (chuẩn hóa 8h){' '}
            {data?.pagination?.total_pages > 1 && (
              <span className="field-hint">- trang {data.pagination.page}/{data.pagination.total_pages}</span>
            )}
          </h2>
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
                <th>Tỷ lệ hư bỏ (%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.nhansu_id}>
                  <td>{r.ho_ten}</td>
                  <td>{formatSoLuong(r.so_bao_cao)}</td>
                  <td>{formatSoThapPhan(r.nang_suat_tb)}</td>
                  <td>{formatSoLuong(r.tong_dat)}</td>
                  <td>{formatSoLuong(r.tong_hu_bo)}</td>
                  <td>{formatSoLuong(r.tong_lua)}</td>
                  <td>{formatSoThapPhan(r.ty_le_hu_bo_pct)}</td>
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
          <Pagination pagination={data?.pagination} onPageChange={setPage} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h2>Breakdown theo vật tư, lô, lỗi (mỗi nhân sự đã lựa gì, ở lô nào, lỗi gì)</h2>
          <button
            className="btn btn-sm"
            onClick={() => downloadExcel('/dashboard/nhansu/vattu/export', cleanParams(filters), 'dashboard_nhan_su_theo_vat_tu.xlsx')}
          >
            Xuất Excel
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Mã vật tư</th>
                <th>Tên vật tư</th>
                <th>Số lô</th>
                <th>Loại lỗi</th>
                <th>Số báo cáo</th>
                <th>Năng suất TB (8h)</th>
                <th>Tổng đạt</th>
                <th>Tổng hư bỏ</th>
                <th>Tổng lựa</th>
                <th>Tỷ lệ hư bỏ (%)</th>
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map((r) => (
                <tr key={`${r.nhansu_id}-${r.lo_id}-${r.loi_chuan_id}`}>
                  <td>{r.ho_ten}</td>
                  <td>{r.ma_vat_tu}</td>
                  <td>{r.ten_vat_tu}</td>
                  <td>{r.so_lo}</td>
                  <td>
                    {r.ten_loi === 'Chưa gán nhãn' ? (
                      <span className="badge badge-muted">Chưa gán nhãn</span>
                    ) : (
                      r.ten_loi
                    )}
                  </td>
                  <td>{formatSoLuong(r.so_bao_cao)}</td>
                  <td>{formatSoThapPhan(r.nang_suat_tb)}</td>
                  <td>{formatSoLuong(r.tong_dat)}</td>
                  <td>{formatSoLuong(r.tong_hu_bo)}</td>
                  <td>{formatSoLuong(r.tong_lua)}</td>
                  <td>{formatSoThapPhan(r.ty_le_hu_bo_pct)}</td>
                </tr>
              ))}
              {breakdownRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-state">
                    Không có dữ liệu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination pagination={breakdownData?.pagination} onPageChange={setBreakdownPage} />
        </div>
      </div>
    </div>
  );
}
