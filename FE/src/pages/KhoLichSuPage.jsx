import { useEffect, useState } from 'react';
import { listGiaoDich, goiYViTri } from '../api/khoApi';
import { listVatTu } from '../api/vattuApi';
import { useFetch } from '../hooks/useFetch';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { formatSoLuong } from '../format';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';
import Alert from '../components/Alert';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import SortableTh from '../components/SortableTh';
import TruncatedText from '../components/TruncatedText';
import VatTuFilterFields from '../components/VatTuFilterFields';

const THAO_TAC = {
  nhap: { label: 'Nhập', badge: 'badge-success' },
  xuat: { label: 'Xuất', badge: 'badge-danger' },
  chuyen_di: { label: 'Chuyển đi', badge: 'badge-warning' },
  chuyen_den: { label: 'Chuyển đến', badge: 'badge-warning' },
  dieu_chinh: { label: 'Điều chỉnh', badge: 'badge-muted' },
};

// Sổ giao dịch vị trí kho: mọi lần nhập / xuất / chuyển / điều chỉnh (chỉ thêm, không sửa). Mới nhất trước.
export default function KhoLichSuPage() {
  const { filters, page, sortBy, sortDir, updateFilter, setPage, toggleSort } = useUrlFilters({
    thao_tac: '',
    ma_vi_tri: '',
    ma_vat_tu: '',
  });
  const { data, loading, error } = useFetch(
    () => listGiaoDich({ ...filters, page, limit: PAGE_SIZE, sort_by: sortBy, sort_dir: sortDir }),
    [filters.thao_tac, filters.ma_vi_tri, filters.ma_vat_tu, page, sortBy, sortDir]
  );
  // Gợi ý mã ô: chờ người dùng ngừng gõ 250ms rồi mới hỏi BE (tránh bắn 1 yêu cầu cho mỗi phím)
  const [maOGoiY, setMaOGoiY] = useState(filters.ma_vi_tri.trim());
  useEffect(() => {
    const t = setTimeout(() => setMaOGoiY(filters.ma_vi_tri.trim()), 250);
    return () => clearTimeout(t);
  }, [filters.ma_vi_tri]);
  const { data: goiYData } = useFetch(() => (maOGoiY ? goiYViTri(maOGoiY) : Promise.resolve(null)), [maOGoiY]);
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);

  return (
    <div>
      <h1 className="page-title">Lịch sử vị trí kho</h1>
      <Alert>{error}</Alert>

      <div className="filter-bar">
        <div className="field">
          <label>Thao tác</label>
          <select value={filters.thao_tac} onChange={(e) => updateFilter({ thao_tac: e.target.value })}>
            <option value="">Tất cả</option>
            {Object.entries(THAO_TAC).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ls-ma-vi-tri">Mã ô</label>
          <SearchInput id="ls-ma-vi-tri" placeholder="Vd K05, S1-O03..." ariaLabel="Tìm theo mã ô" value={filters.ma_vi_tri} onChange={(v) => updateFilter({ ma_vi_tri: v })} suggestions={goiYData?.data} suggestionsTotal={goiYData?.total} />
        </div>
        <VatTuFilterFields
          vatTuList={vatTuData?.data}
          value={filters.ma_vat_tu}
          onChange={(v) => updateFilter({ ma_vat_tu: v })}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Sổ giao dịch {data?.pagination ? `(${formatSoLuong(data.pagination.total)})` : ''}</h2>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh label="Thời gian" sortKey="thoi_gian" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Thao tác" sortKey="thao_tac" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Ô" sortKey="ma_vi_tri" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Lô" sortKey="so_lo" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Số lượng" sortKey="so_luong" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <th>Người thực hiện</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((r) => {
                  const t = THAO_TAC[r.thao_tac] || { label: r.thao_tac, badge: 'badge-muted' };
                  return (
                    <tr key={r.id}>
                      <td>{new Date(r.thoi_gian).toLocaleString('vi-VN')}</td>
                      <td><span className={`badge ${t.badge}`}>{t.label}</span></td>
                      <td className="kho-gd-chuyen">{r.ma_vi_tri}</td>
                      <td>{r.so_lo} <span className="field-hint">({r.ma_vat_tu})</span></td>
                      <td>{r.so_luong === null ? <span className="field-hint">Chưa biết</span> : formatSoLuong(r.so_luong)}</td>
                      <td>{r.nguoi_thuc_hien || '-'}</td>
                      <td><TruncatedText text={r.ghi_chu} fallback="-" /></td>
                    </tr>
                  );
                })}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">Chưa có giao dịch nào</td>
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
