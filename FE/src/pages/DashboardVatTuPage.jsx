import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardTheoVatTu, dashboardLoiTheoVatTu } from '../api/dashboardApi';
import { listLoaiLoi } from '../api/loailoiApi';
import { listVatTu } from '../api/vattuApi';
import { listLo } from '../api/loApi';
import { listNhaCungCap } from '../api/nhacungcapApi';
import { downloadExcel } from '../api/client';
import { formatSoLuong, formatSoThapPhan } from '../format';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import DashboardFilterBar from '../components/DashboardFilterBar';
import Pagination from '../components/Pagination';
import VatTuFilterFields from '../components/VatTuFilterFields';
import TruncatedText from '../components/TruncatedText';
import SearchableSelect from '../components/SearchableSelect';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';
import { loValue, loLabel, nccValue, nccLabel } from '../selectHelpers';
import { SEQUENTIAL_BLUE, CHART_GRID, CHART_AXIS } from '../chartColors';

const emptyFilters = { tu_ngay: '', den_ngay: '', la_lua_lai: 'false', loi_chuan_id: '', ma_vat_tu: '', lo_id: '', ma_ncc: '' };

export default function DashboardVatTuPage() {
  const [page, setPage] = useState(1);
  const [loiPage, setLoiPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);
  const { data, loading, error } = useFetch(
    () => dashboardTheoVatTu({ ...cleanParams(filters), page, limit: PAGE_SIZE }),
    [filters.tu_ngay, filters.den_ngay, filters.la_lua_lai, filters.loi_chuan_id, filters.ma_vat_tu, filters.lo_id, filters.ma_ncc, page]
  );
  const { data: loiData } = useFetch(
    () => dashboardLoiTheoVatTu({ ...cleanParams(filters), loi_chuan_id: undefined, page: loiPage, limit: PAGE_SIZE }),
    [filters.tu_ngay, filters.den_ngay, filters.la_lua_lai, filters.ma_vat_tu, filters.lo_id, filters.ma_ncc, loiPage]
  );
  const { data: loaiLoiData } = useFetch(() => listLoaiLoi({ limit: ALL_LIMIT }), []);
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const { data: loData } = useFetch(() => listLo({ limit: ALL_LIMIT }), []);
  const { data: nccData } = useFetch(() => listNhaCungCap({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  const nccList = nccData?.data || [];
  const loiRows = loiData?.data;
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
    if (f.loi_chuan_id) p.loi_chuan_id = f.loi_chuan_id;
    if (f.ma_vat_tu) p.ma_vat_tu = f.ma_vat_tu;
    if (f.lo_id) p.lo_id = f.lo_id;
    if (f.ma_ncc) p.ma_ncc = f.ma_ncc;
    return p;
  }

  function handleFilterChange(next) {
    setFilters(next);
    setPage(1);
    setLoiPage(1);
  }

  function handleVatTuChange(v) {
    const loMoiHopLe = !v || !filters.lo_id || (loData?.data || []).some(
      (l) => String(l.id) === String(filters.lo_id) && l.ma_vat_tu === v
    );
    const loiMoiHopLe = !v || !filters.loi_chuan_id || (loaiLoiData?.data || []).some(
      (l) => String(l.id) === String(filters.loi_chuan_id) && l.ma_vat_tu === v
    );
    handleFilterChange({
      ...filters,
      ma_vat_tu: v,
      lo_id: loMoiHopLe ? filters.lo_id : '',
      loi_chuan_id: loiMoiHopLe ? filters.loi_chuan_id : '',
    });
  }

  const rows = data?.data || [];
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
        setFilters={handleFilterChange}
        extra={
          <>
            <VatTuFilterFields vatTuList={vatTuList} value={filters.ma_vat_tu} onChange={handleVatTuChange} />
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
            <div className="field">
              <label>Lỗi chuẩn (admin gán)</label>
              <select value={filters.loi_chuan_id} onChange={(e) => handleFilterChange({ ...filters, loi_chuan_id: e.target.value })}>
                <option value="">Tất cả</option>
                {loaiLoiList?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.ma_vat_tu} - {l.ten_loi}
                  </option>
                ))}
              </select>
            </div>
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
          </>
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
                <th>Mã vật tư</th>
                <th>Tên vật tư</th>
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
                  <td>{r.ma_vat_tu}</td>
                  <td><TruncatedText text={r.ten_vat_tu} /></td>
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
        </div>
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h2>Breakdown lỗi theo vật tư</h2>
          <button
            className="btn btn-sm"
            onClick={() =>
              downloadExcel(
                '/dashboard/vattu/loi/export',
                { ...cleanParams(filters), loi_chuan_id: undefined },
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
                <th>Mã vật tư</th>
                <th>Tên vật tư</th>
                <th>Số lô</th>
                <th>Nhà cung cấp</th>
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
              {loiRows?.map((r) => (
                <tr key={`${r.lo_id}-${r.loi_chuan_id}`}>
                  <td>{r.ma_vat_tu}</td>
                  <td><TruncatedText text={r.ten_vat_tu} /></td>
                  <td>{r.so_lo}</td>
                  <td><TruncatedText text={r.ten_ncc} fallback={<span className="field-hint">Chưa có</span>} /></td>
                  <td>
                    {r.ten_loi === 'Chưa gán nhãn' ? (
                      <span className="badge badge-muted">Chưa gán nhãn</span>
                    ) : (
                      <TruncatedText text={r.ten_loi} maxWidth={200} />
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
              {(!loiRows || loiRows.length === 0) && (
                <tr>
                  <td colSpan={10} className="empty-state">
                    Không có dữ liệu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={loiData?.pagination} onPageChange={setLoiPage} />
      </div>
    </div>
  );
}
