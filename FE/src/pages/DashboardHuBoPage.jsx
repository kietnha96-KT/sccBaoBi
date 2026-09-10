import { useEffect, useState } from 'react';
import { dashboardHuBo } from '../api/dashboardApi';
import { listLoaiLoi } from '../api/loailoiApi';
import { listVatTu } from '../api/vattuApi';
import { listLo } from '../api/loApi';
import { listNhaCungCap } from '../api/nhacungcapApi';
import { downloadExcel } from '../api/client';
import { formatSoLuong, formatSoThapPhan } from '../format';
import { useFetch } from '../hooks/useFetch';
import { useRowSelect } from '../hooks/useRowSelect';
import { useCloseOnBackButton } from '../hooks/useCloseOnBackButton';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import VatTuFilterFields from '../components/VatTuFilterFields';
import SearchableSelect from '../components/SearchableSelect';
import SelectionActionBar from '../components/SelectionActionBar';
import HuBoDetail from '../components/HuBoDetail';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';
import { loValue, loLabel, nccValue, nccLabel } from '../selectHelpers';

// Sản lượng & hư bỏ theo lô - chỉ số CHẤT LƯỢNG (tách khỏi dashboard năng suất).
// Mỗi dòng = 1 lô. Bấm dòng -> nút Xem -> popup liệt kê từng báo cáo của lô.
// Phạm vi: toàn bộ lịch sử của lô (KHÔNG lọc ngày, giống Báo công), chỉ báo cáo lựa chính.
// Tỷ lệ hư bỏ = SUM(hư) / SUM(lựa) (có trọng số). Đã loại báo cáo dính loại lỗi đặc biệt.
const emptyFilters = { ma_vat_tu: '', lo_id: '', ma_ncc: '', loi_chuan_id: '' };

// màu theo mức tỷ lệ hư bỏ
function pctColor(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return 'var(--text-muted)';
  if (n >= 10) return 'var(--danger)';
  if (n >= 5) return 'var(--warning)';
  return 'var(--text-muted)';
}
const pctText = (v) => (v == null ? '—' : `${formatSoThapPhan(v)}%`);

export default function DashboardHuBoPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);
  const { selectedRowId, setSelectedRowId, getRowProps } = useRowSelect();
  const [viewRow, setViewRow] = useState(null);
  useCloseOnBackButton(!!viewRow, () => setViewRow(null));

  const { data, loading, error } = useFetch(
    () => dashboardHuBo({ ...cleanParams(filters), page, limit: PAGE_SIZE }),
    [filters.ma_vat_tu, filters.lo_id, filters.ma_ncc, filters.loi_chuan_id, page]
  );
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const { data: loData } = useFetch(() => listLo({ limit: ALL_LIMIT }), []);
  const { data: nccData } = useFetch(() => listNhaCungCap({ limit: ALL_LIMIT }), []);
  const { data: loaiLoiData } = useFetch(() => listLoaiLoi({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  const nccList = nccData?.data || [];
  const loList = filters.ma_vat_tu
    ? (loData?.data || []).filter((l) => l.ma_vat_tu === filters.ma_vat_tu)
    : loData?.data || [];
  // Bộ lọc "Loại lỗi (đã gán)" = lọc theo loi_chuan_id -> chỉ loại lỗi dùng để gán nhãn
  // ('gan_nhan' | 'ca_hai'), bỏ loại chỉ để tách hư bỏ.
  const loaiLoiList = (loaiLoiData?.data || []).filter(
    (l) =>
      l.muc_dich !== 'tach_hu_bo' &&
      (!filters.ma_vat_tu || l.ma_vat_tu === filters.ma_vat_tu)
  );

  function cleanParams(f) {
    const p = {};
    if (f.ma_vat_tu) p.ma_vat_tu = f.ma_vat_tu;
    if (f.lo_id) p.lo_id = f.lo_id;
    if (f.ma_ncc) p.ma_ncc = f.ma_ncc;
    if (f.loi_chuan_id) p.loi_chuan_id = f.loi_chuan_id;
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
    const loiConHopLe = !v || !filters.loi_chuan_id || (loaiLoiData?.data || []).some(
      (l) => String(l.id) === String(filters.loi_chuan_id) && l.ma_vat_tu === v
    );
    handleFilterChange({
      ...filters,
      ma_vat_tu: v,
      lo_id: loConHopLe ? filters.lo_id : '',
      loi_chuan_id: loiConHopLe ? filters.loi_chuan_id : '',
    });
  }

  const rows = data?.data || [];
  const selectedRow = rows.find((r) => r.lo_id === selectedRowId) || null;

  // đổi bộ lọc / trang -> bỏ chọn
  useEffect(() => {
    setSelectedRowId(null);
  }, [filters.ma_vat_tu, filters.lo_id, filters.ma_ncc, filters.loi_chuan_id, page, setSelectedRowId]);

  return (
    <div className={selectedRow ? 'has-selection-bar' : undefined}>
      <h1 className="page-title">Sản lượng &amp; hư bỏ theo lô</h1>
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
        <div className="field">
          <label>Loại lỗi (đã gán)</label>
          <select
            value={filters.loi_chuan_id}
            onChange={(e) => handleFilterChange({ ...filters, loi_chuan_id: e.target.value })}
          >
            <option value="">Tất cả</option>
            {loaiLoiList.map((l) => (
              <option key={l.id} value={l.id}>
                {l.ma_vat_tu} - {l.ten_loi}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>
            Tỷ lệ hư bỏ theo lô
            <span className="field-hint h2-note">
              (chỉ báo cáo lựa chính)
            </span>
          </h2>
          <button
            className="btn btn-sm"
            onClick={() => downloadExcel('/dashboard/hu-bo/export', cleanParams(filters), 'dashboard_hu_bo.xlsx')}
          >
            Xuất Excel
          </button>
        </div>

        <SelectionActionBar
          selected={selectedRow}
          onClear={() => setSelectedRowId(null)}
          idleHint="Bấm vào một dòng để xem chi tiết từng báo cáo"
          label={
            selectedRow && (
              <>
                <strong>{selectedRow.ma_vat_tu}</strong> / {selectedRow.so_lo} · {selectedRow.ten_vat_tu}
              </>
            )
          }
          extra={
            selectedRow && (
              <>
                Tổng lô <strong>{formatSoLuong(selectedRow.so_luong_lo)}</strong> / hư <strong>{formatSoLuong(selectedRow.tong_hu_bo)}</strong> ·{' '}
                <strong style={{ color: pctColor(selectedRow.ty_le_hu_bo_pct) }}>
                  {pctText(selectedRow.ty_le_hu_bo_pct)}
                </strong>
              </>
            )
          }
        >
          <button className="btn btn-sm btn-primary" onClick={() => setViewRow(selectedRow)}>
            Xem
          </button>
        </SelectionActionBar>

        <div className="table-wrap">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã vật tư</th>
                  {/* <th>Tên vật tư</th> */}
                  <th>Số lô</th>
                  {/* <th>Nhà cung cấp</th> */}
                  <th>Tổng lô</th>
                  <th>Tổng hư bỏ</th>
                  <th>Tỷ lệ hư bỏ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.lo_id} {...getRowProps(r.lo_id)}>
                    <td>{r.ma_vat_tu}</td>
                    {/* <td><TruncatedText text={r.ten_vat_tu} /></td> */}
                    <td>{r.so_lo}</td>
                    {/* <td><TruncatedText text={r.ten_ncc} fallback={<span className="field-hint">Chưa có</span>} /></td> */}
                    <td>{formatSoLuong(r.so_luong_lo)}</td>
                    <td>{formatSoLuong(r.tong_hu_bo)}</td>
                    <td>
                      <strong style={{ color: pctColor(r.ty_le_hu_bo_pct) }}>{pctText(r.ty_le_hu_bo_pct)}</strong>
                    </td>
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
          )}
        </div>
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {viewRow && (
        <Modal
          title={`Chi tiết hư bỏ · lô ${viewRow.so_lo} (${viewRow.ma_vat_tu})`}
          onClose={() => setViewRow(null)}
          size="lg"
        >
          <HuBoDetail row={viewRow} params={cleanParams(filters)} />
          <div className="btn-group mt-16">
            <button type="button" className="btn" onClick={() => setViewRow(null)}>
              Đóng
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
