import { useState } from 'react';
import { formatSoLuong, firstDayOfThisMonth, lastDayOfThisMonth } from '../format';
import { useRowSelect } from '../hooks/useRowSelect';
import { useCloseOnBackButton } from '../hooks/useCloseOnBackButton';
import { listBaoCao, deleteBaoCao, ganLoiChuan } from '../api/baocaoApi';
import { listVatTu } from '../api/vattuApi';
import { listLo } from '../api/loApi';
import { listLoaiLoi } from '../api/loailoiApi';
import { listNhanSu } from '../api/nhansuApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../hooks/useAuth';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import BaoCaoForm from '../components/BaoCaoForm';
import SelectionActionBar from '../components/SelectionActionBar';
import Pagination from '../components/Pagination';
import VatTuFilterFields from '../components/VatTuFilterFields';
import SearchableSelect from '../components/SearchableSelect';
import TruncatedText from '../components/TruncatedText';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';
import { loValue, loLabel } from '../selectHelpers';

const emptyFilters = {
  tu_ngay: firstDayOfThisMonth(),
  den_ngay: lastDayOfThisMonth(),
  ma_vat_tu: '',
  lo_id: '',
  la_lua_lai: '',
  nguoi_nhap_id: '',
  nhansu_id: '',
  page: 1,
  limit: PAGE_SIZE,
};

export default function BaoCaoListPage() {
  const { user, isAdmin, isStaff } = useAuth();
  const [filters, setFilters] = useState(emptyFilters);
  const [actionError, setActionError] = useState('');
  // null = đóng | 'create' = nhập mới | { editId } = sửa báo cáo đó
  const [formModal, setFormModal] = useState(null);
  const { selectedRowId, setSelectedRowId, getRowProps } = useRowSelect();
  useCloseOnBackButton(!!formModal, () => setFormModal(null));

  const { data, loading, error, reload } = useFetch(
    () => listBaoCao(cleanParams(filters)),
    [
      filters.tu_ngay,
      filters.den_ngay,
      filters.ma_vat_tu,
      filters.lo_id,
      filters.la_lua_lai,
      filters.nguoi_nhap_id,
      filters.nhansu_id,
      filters.page,
      filters.limit,
    ]
  );
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const { data: loData } = useFetch(() => listLo({ limit: ALL_LIMIT }), []);
  const { data: loaiLoiData } = useFetch(() => listLoaiLoi({ limit: ALL_LIMIT }), []);
  const { data: nhanSuData } = useFetch(() => listNhanSu({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  const loaiLoiList = loaiLoiData?.data;
  const nhanSuList = nhanSuData?.data;
  const loList = filters.ma_vat_tu
    ? (loData?.data || []).filter((l) => l.ma_vat_tu === filters.ma_vat_tu)
    : loData?.data || [];

  function cleanParams(f) {
    const p = { page: f.page, limit: f.limit };
    if (f.tu_ngay) p.tu_ngay = f.tu_ngay;
    if (f.den_ngay) p.den_ngay = f.den_ngay;
    if (f.ma_vat_tu) p.ma_vat_tu = f.ma_vat_tu;
    if (f.lo_id) p.lo_id = f.lo_id;
    if (f.la_lua_lai !== '') p.la_lua_lai = f.la_lua_lai;
    if (f.nguoi_nhap_id) p.nguoi_nhap_id = f.nguoi_nhap_id;
    if (f.nhansu_id) p.nhansu_id = f.nhansu_id;
    return p;
  }

  function updateFilter(patch) {
    setSelectedRowId(null); // dòng đang chọn có thể không còn ở trang/kết quả mới
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  const selectedRow = (data?.data || []).find((r) => r.id === selectedRowId) || null;
  const canModifySelected = selectedRow && (selectedRow.co_the_sua_xoa_hom_nay || isAdmin);

  // Nút Sửa/Xóa trên thanh hành động - kiểm khóa "qua ngày" tại đây (backend vẫn chặn lần nữa)
  function suaDaChon() {
    if (!selectedRow) return;
    if (!canModifySelected) {
      alert(
        `Báo cáo #${selectedRow.id} đã khóa (không còn trong ngày nhập). Chỉ admin mới sửa/xóa được.`
      );
      return;
    }
    setActionError('');
    setFormModal({ editId: selectedRow.id });
  }

  async function xoaDaChon() {
    if (!selectedRow) return;
    if (!canModifySelected) {
      alert(
        `Báo cáo #${selectedRow.id} đã khóa (không còn trong ngày nhập). Chỉ admin mới sửa/xóa được.`
      );
      return;
    }
    if (!confirm(`Xóa báo cáo #${selectedRow.id}?`)) return;
    setActionError('');
    try {
      await deleteBaoCao(selectedRow.id);
      setSelectedRowId(null);
      reload({ silent: true });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  async function handleGanLoi(row, loiChuanId) {
    setActionError('');
    try {
      await ganLoiChuan(row.id, loiChuanId || null);
      reload({ silent: true });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  function handleFormDone(saved) {
    setFormModal(null);
    if (saved) {
      setSelectedRowId(null);
      reload({ silent: true });
    }
  }

  const pagination = data?.pagination;

  return (
    <div className={selectedRow ? 'has-selection-bar' : undefined}>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Danh sách báo cáo
      </h1>

      <Alert>{error}</Alert>
      <Alert>{actionError}</Alert>

      <div className="filter-bar">
        <div className="field">
          <label>Từ ngày</label>
          <input type="date" value={filters.tu_ngay} onChange={(e) => updateFilter({ tu_ngay: e.target.value })} />
        </div>
        <div className="field">
          <label>Đến ngày</label>
          <input type="date" value={filters.den_ngay} onChange={(e) => updateFilter({ den_ngay: e.target.value })} />
        </div>
        <VatTuFilterFields
          vatTuList={vatTuList}
          value={filters.ma_vat_tu}
          onChange={(v) => {
            // doi vat tu thi bo chon lo cu neu lo do khong thuoc vat tu moi
            const loMoiHopLe = !v || !filters.lo_id || (loData?.data || []).some(
              (l) => String(l.id) === String(filters.lo_id) && l.ma_vat_tu === v
            );
            updateFilter({ ma_vat_tu: v, lo_id: loMoiHopLe ? filters.lo_id : '' });
          }}
        />
        <div className="field" style={{ minWidth: 220 }}>
          <label>Số lô</label>
          <SearchableSelect
            options={loList}
            getValue={loValue}
            getLabel={loLabel}
            value={filters.lo_id}
            onChange={(v) => updateFilter({ lo_id: v })}
            placeholder="Gõ số lô..."
          />
        </div>
        <div className="field">
          <label>Loại báo cáo</label>
          <select value={filters.la_lua_lai} onChange={(e) => updateFilter({ la_lua_lai: e.target.value })}>
            <option value="">Tất cả</option>
            <option value="false">Lựa chính</option>
            <option value="true">Lựa lại</option>
          </select>
        </div>
        <div className="field">
          <label>Người nhập</label>
          <select value={filters.nguoi_nhap_id} onChange={(e) => updateFilter({ nguoi_nhap_id: e.target.value })}>
            <option value="">Tất cả</option>
            {nhanSuList?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.ho_ten}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Nhân sự tham gia</label>
          <select value={filters.nhansu_id} onChange={(e) => updateFilter({ nhansu_id: e.target.value })}>
            <option value="">Tất cả</option>
            {nhanSuList?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.ho_ten}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <button type="button" className="btn" onClick={() => updateFilter({ nhansu_id: user.id, nguoi_nhap_id: '' })}>
            Chỉ báo cáo của tôi
          </button>
        </div>
        <div className="field">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSelectedRowId(null);
              setFilters(emptyFilters);
            }}
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Kết quả {pagination ? `(${pagination.total})` : ''}</h2>
          <div className="btn-group">
            <button
              className="btn btn-sm"
              onClick={() => downloadExcel('/baocao/export', cleanParams(filters), 'danh_sach_bao_cao.xlsx')}
            >
              Xuất Excel
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setFormModal('create')}>
              + Nhập báo cáo
            </button>
          </div>
        </div>

        <SelectionActionBar
          selected={selectedRow}
          onClear={() => setSelectedRowId(null)}
          idleHint="Bấm vào một dòng trong bảng để Sửa / Xóa"
          label={
            selectedRow && (
              <>
                Báo cáo <strong>#{selectedRow.id}</strong> · {selectedRow.ma_vat_tu} ·{' '}
                {new Date(selectedRow.ngay).toLocaleDateString('vi-VN')}
                {!canModifySelected && <span className="field-hint"> · đã khóa</span>}
              </>
            )
          }
        >
          <button className="btn btn-sm btn-primary" onClick={suaDaChon}>
            Sửa
          </button>
          <button className="btn btn-sm btn-danger" onClick={xoaDaChon}>
            Xóa
          </button>
        </SelectionActionBar>

        <div className="table-wrap">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : (
            <table className="data-table freeze-3">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ngày</th>
                  <th>Mã vật tư</th>
                  <th>Tên vật tư</th>
                  <th>Số lô</th>
                  <th>Đạt</th>
                  <th>Hư bỏ</th>
                  <th>Tổng lựa</th>
                  <th>Người nhập</th>
                  <th>Nhân sự tham gia</th>
                  <th>Lỗi (tự do)</th>
                  <th>Lựa lại</th>
                  {isStaff && <th>Lỗi chuẩn</th>}
                  <th>Khóa</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row) => (
                  <tr key={row.id} {...getRowProps(row.id)}>
                    <td>{row.id}</td>
                    <td>{new Date(row.ngay).toLocaleDateString('vi-VN')}</td>
                    <td>{row.ma_vat_tu}</td>
                    <td><TruncatedText text={row.ten_vat_tu} /></td>
                    <td>{row.so_lo}</td>
                    <td>{formatSoLuong(row.dat)}</td>
                    <td>{formatSoLuong(row.hu_bo)}</td>
                    <td>{formatSoLuong(row.tong_lua)}</td>
                    <td><TruncatedText text={row.nguoi_nhap_ho_ten} maxWidth={160} /></td>
                    <td><TruncatedText text={row.nhansu_tham_gia.map((n) => n.ho_ten).join(', ')} maxWidth={200} /></td>
                    <td><TruncatedText text={row.loi_nguoi_dung || '-'} maxWidth={200} /></td>
                    <td>
                      {row.la_lua_lai ? (
                        <span className="badge badge-warning">Lựa lại</span>
                      ) : (
                        <span className="badge badge-muted">Lựa chính</span>
                      )}
                    </td>
                    {isStaff && (
                      <td>
                        <select
                          className="loi-chuan-select"
                          title={row.loi_chuan_ten || 'Chưa gán'}
                          value={row.loi_chuan_id || ''}
                          onChange={(e) => handleGanLoi(row, e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">-- Chưa gán --</option>
                          {loaiLoiList
                            ?.filter((l) => l.ma_vat_tu === row.ma_vat_tu)
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.ten_loi}
                              </option>
                            ))}
                        </select>
                      </td>
                    )}
                    <td>
                      {!(row.co_the_sua_xoa_hom_nay || isAdmin) && (
                        <span className="field-hint">🔒 Đã khóa</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={isStaff ? 14 : 13} className="empty-state">
                      Không có báo cáo nào khớp bộ lọc
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <Pagination pagination={pagination} onPageChange={(p) => updateFilter({ page: p })} />
      </div>

      {formModal && (
        <Modal
          title={formModal === 'create' ? 'Nhập báo cáo lựa vật tư' : `Sửa báo cáo #${formModal.editId}`}
          onClose={() => setFormModal(null)}
          size="lg"
        >
          <BaoCaoForm
            id={formModal === 'create' ? undefined : formModal.editId}
            onDone={handleFormDone}
          />
        </Modal>
      )}
    </div>
  );
}
