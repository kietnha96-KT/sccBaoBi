import { useEffect, useState } from 'react';
import { dashboardBaoCongTheoLo } from '../api/dashboardApi';
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
import BaoCongLoDetail from '../components/BaoCongLoDetail';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';
import { loValue, loLabel, nccValue, nccLabel } from '../selectHelpers';

// Báo công (giờ làm) theo lô - KHÁC dashboard năng suất. Tổng giờ làm từng lô, tách 2:
// giờ theo LỖI THƯỜNG (gồm cả báo cáo chưa gán nhãn) và giờ theo LỖI ĐẶC BIỆT.
// Báo cáo làm chung -> giờ chia đều cho mỗi người rồi cộng dồn.
// Phạm vi: toàn bộ lịch sử của lô (không lọc ngày), CHỈ báo cáo lựa chính.
// Chi tiết giờ theo người xem ở popup (bấm dòng -> nút Xem trên thanh chọn).
const emptyFilters = { ma_vat_tu: '', lo_id: '', ma_ncc: '' };

const gioText = (h) => (h == null ? '—' : `${formatSoThapPhan(h, 1)}h`);

export default function DashboardBaoCongLoPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);
  const { selectedRowId, setSelectedRowId, getRowProps } = useRowSelect();
  const [viewLo, setViewLo] = useState(null);
  useCloseOnBackButton(!!viewLo, () => setViewLo(null));

  const { data, loading, error } = useFetch(
    () => dashboardBaoCongTheoLo({ ...cleanParams(filters), page, limit: PAGE_SIZE }),
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

  const rows = data?.data || [];
  const selectedLo = rows.find((r) => r.lo_id === selectedRowId) || null;

  // đổi bộ lọc / trang -> bỏ chọn
  useEffect(() => {
    setSelectedRowId(null);
  }, [filters.ma_vat_tu, filters.lo_id, filters.ma_ncc, page, setSelectedRowId]);

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

  return (
    <div className={selectedLo ? 'has-selection-bar' : undefined}>
      <h1 className="page-title">
        Báo công (giờ làm) theo lô
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
            Giờ làm theo lô
            <span className="field-hint h2-note">
              (chỉ báo cáo lựa chính)
            </span>
          </h2>
          <button
            className="btn btn-sm"
            onClick={() => downloadExcel('/dashboard/baocong-lo/export', cleanParams(filters), 'bao_cong_theo_lo.xlsx')}
          >
            Xuất Excel
          </button>
        </div>

        <SelectionActionBar
          selected={selectedLo}
          onClear={() => setSelectedRowId(null)}
          idleHint="Bấm vào một dòng để xem chi tiết giờ theo người"
          label={selectedLo && (<><strong>{selectedLo.ma_vat_tu}</strong> / {selectedLo.so_lo} · {selectedLo.ten_vat_tu}</>)}
          extra={
            selectedLo && (
              <>
                Tổng <strong>{gioText(selectedLo.tong_gio_lam)}</strong>
                {' · '}thường {gioText(selectedLo.gio_thuong)}
                {' · '}<span className="text-warning">đặc biệt {gioText(selectedLo.gio_dac_biet)}</span>
              </>
            )
          }
        >
          <button className="btn btn-sm btn-primary" onClick={() => setViewLo(selectedLo)}>
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
                  <th>Số lượng lô</th>
                  {/* <th>Số báo cáo</th> */}
                  <th>Tổng giờ</th>
                  <th>Giờ lỗi thường</th>
                  <th>Giờ lỗi đặc biệt</th>
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
                    {/* <td>{formatSoLuong(r.so_bao_cao)}</td> */}
                    <td><strong>{gioText(r.tong_gio_lam)}</strong></td>
                    <td>{Number(r.gio_thuong) > 0
                      ? <span className="text-blue fw-600">{gioText(r.gio_thuong)}</span>
                      : <span className="field-hint">—</span>}</td>
                    <td>
                      {Number(r.gio_dac_biet) > 0
                        ? <span className="text-warning fw-600">{gioText(r.gio_dac_biet)}</span>
                        : <span className="field-hint">—</span>}
                    </td>
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
          )}
        </div>
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {viewLo && (
        <Modal
          title={`Chi tiết công: ${viewLo.ma_vat_tu} (${viewLo.so_lo})`}
          onClose={() => setViewLo(null)}
          size="lg"
        >
          <BaoCongLoDetail lo={viewLo} />
          <div className="btn-group mt-16">
            <button type="button" className="btn" onClick={() => setViewLo(null)}>
              Đóng
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
