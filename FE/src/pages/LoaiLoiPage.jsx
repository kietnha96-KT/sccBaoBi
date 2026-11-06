import { useEffect, useRef, useState } from 'react';
import {
  listLoaiLoi,
  createLoaiLoi,
  updateLoaiLoi,
  deleteLoaiLoi,
  loaiLoiSuDung,
} from '../api/loailoiApi';
import { listVatTu, listThuKho } from '../api/vattuApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { formatSoLuong } from '../format';
import { useFetch } from '../hooks/useFetch';
import { useRowSelect } from '../hooks/useRowSelect';
import { useUrlFilters } from '../hooks/useUrlFilters';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import ImportExcelButton from '../components/ImportExcelButton';
import SearchableSelect from '../components/SearchableSelect';
import SelectionActionBar from '../components/SelectionActionBar';
import TruncatedText from '../components/TruncatedText';
import VatTuFilterFields from '../components/VatTuFilterFields';
import SortableTh from '../components/SortableTh';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';

// Mục đích dùng của loại lỗi:
//  - gan_nhan  : chỉ để gán nhãn lỗi chuẩn cho báo cáo (phân tích năng suất)
//  - tach_hu_bo: chỉ để nhập số lượng hư bỏ chi tiết trong báo cáo
//  - ca_hai    : dùng cho cả hai
const MUC_DICH_LABEL = { gan_nhan: 'Gán nhãn', tach_hu_bo: 'Tách hư bỏ', ca_hai: 'Cả hai' };

export default function LoaiLoiPage() {
  const { filters, page, sortBy, sortDir, updateFilter, setPage, toggleSort } = useUrlFilters({
    ma_vat_tu: '',
    thu_kho: '',
  });
  const { data, loading, error, reload } = useFetch(
    () =>
      listLoaiLoi({
        ma_vat_tu: filters.ma_vat_tu || undefined,
        thu_kho: filters.thu_kho || undefined,
        page,
        limit: PAGE_SIZE,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
    [filters.ma_vat_tu, filters.thu_kho, page, sortBy, sortDir]
  );
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  const { data: thuKhoData } = useFetch(listThuKho, []);
  const thuKhoList = thuKhoData || [];
  const { selectedRowId, setSelectedRowId, getRowProps } = useRowSelect();

  const selectedRow = (data?.data || []).find((r) => r.id === selectedRowId) || null;

  useEffect(() => {
    setSelectedRowId(null);
  }, [filters.ma_vat_tu, filters.thu_kho, page, setSelectedRowId]);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ ma_vat_tu: '', ten_loi: '', la_loi_noi_bo: false, muc_dich: 'gan_nhan' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  // Loại lỗi đang sửa đã có dữ liệu dùng chưa (nạp khi mở form sửa). Có dữ liệu thì khóa
  // mục đích + cờ lỗi nội bộ, chỉ cho đổi tên (backend cũng từ chối nếu cố đổi).
  const [suDung, setSuDung] = useState(null);
  // số thứ tự của lần nạp "đã có dữ liệu dùng chưa": mở loại lỗi khác / mở form thêm thì kết quả
  // của lần nạp trước (về muộn) bị bỏ qua, không ghi đè lên loại lỗi đang mở.
  const suDungReqRef = useRef(0);

  function openCreate() {
    suDungReqRef.current += 1;
    setForm({ ma_vat_tu: filters.ma_vat_tu || '', ten_loi: '', la_loi_noi_bo: false, muc_dich: 'gan_nhan' });
    setFormError('');
    setSuDung(null);
    setModal('create');
  }

  function openEdit(row) {
    setForm({
      ma_vat_tu: row.ma_vat_tu,
      ten_loi: row.ten_loi,
      la_loi_noi_bo: !!row.la_loi_noi_bo,
      // Lỗi nội bộ luôn khóa mục đích = 'gan_nhan' (xem ghi chú ở ô chọn bên dưới).
      muc_dich: row.la_loi_noi_bo ? 'gan_nhan' : row.muc_dich || 'gan_nhan',
    });
    setFormError('');
    setSuDung(null);
    setModal({ edit: row });
    const reqId = ++suDungReqRef.current;
    loaiLoiSuDung(row.id)
      .then((r) => {
        if (reqId === suDungReqRef.current) setSuDung(r);
      })
      .catch(() => {
        if (reqId === suDungReqRef.current) setSuDung(null);
      });
  }

  // Đã có dữ liệu dùng -> khóa "bản chất" (mục đích, lỗi nội bộ), chỉ đổi tên được.
  const daKhoa = !!(modal?.edit && suDung?.da_co_du_lieu);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    setSaving(true);
    try {
      if (modal === 'create') {
        await createLoaiLoi(form);
      } else {
        await updateLoaiLoi(modal.edit.id, {
          ten_loi: form.ten_loi,
          la_loi_noi_bo: form.la_loi_noi_bo,
          muc_dich: form.muc_dich,
        });
      }
      setModal(null);
      setSelectedRowId(null);
      reload({ silent: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!row) return;
    if (!confirm(`Xóa loại lỗi "${row.ten_loi}"?`)) return;
    try {
      await deleteLoaiLoi(row.id);
      setSelectedRowId(null);
      reload({ silent: true });
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }

  return (
    <div className={selectedRow ? 'has-selection-bar' : undefined}>
      <h1 className="page-title">
        Danh mục loại lỗi
      </h1>
      <Alert>{error}</Alert>

      <div className="filter-bar">
        <VatTuFilterFields
          vatTuList={vatTuList}
          value={filters.ma_vat_tu}
          onChange={(v) => updateFilter({ ma_vat_tu: v })}
        />
        <div className="field field-md">
          <label>Thủ kho</label>
          <SearchableSelect
            options={thuKhoList}
            getValue={(t) => t}
            getLabel={(t) => t}
            value={filters.thu_kho}
            onChange={(v) => updateFilter({ thu_kho: v })}
            placeholder="Gõ tên thủ kho..."
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Danh sách loại lỗi {data?.pagination ? `(${data.pagination.total})` : ''}</h2>
          <div className="btn-group">
            <button className="btn btn-sm" onClick={() => downloadExcel('/loailoi/export', {}, 'danh_muc_loi.xlsx')}>
              Xuất Excel
            </button>
            <ImportExcelButton
              endpoint="/loailoi/import"
              columnsHint="Mã vật tư, Tên lỗi"
              onImported={reload}
            />
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + Thêm loại lỗi
            </button>
          </div>
        </div>

        <SelectionActionBar
          selected={selectedRow}
          onClear={() => setSelectedRowId(null)}
          idleHint="Bấm vào một dòng để Sửa / Xóa"
          label={selectedRow && `${selectedRow.ma_vat_tu} · ${selectedRow.ten_loi}`}
        >
          <button className="btn btn-sm btn-primary" onClick={() => openEdit(selectedRow)}>
            Sửa
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedRow)}>
            Xóa
          </button>
        </SelectionActionBar>

        <div className="table-wrap">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh label="Mã vật tư" sortKey="ma_vat_tu" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Tên vật tư" sortKey="ten_vat_tu" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Tên lỗi" sortKey="ten_loi" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Mục đích" sortKey="muc_dich" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Lỗi nội bộ" sortKey="la_loi_noi_bo" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row) => (
                  <tr key={row.id} {...getRowProps(row.id)}>
                    <td>{row.ma_vat_tu}</td>
                    <td><TruncatedText text={row.ten_vat_tu} /></td>
                    <td><TruncatedText text={row.ten_loi} maxWidth={220} /></td>
                    <td>{MUC_DICH_LABEL[row.muc_dich] || row.muc_dich}</td>
                    <td>
                      {row.la_loi_noi_bo ? (
                        <span className="badge badge-warning">Nội bộ</span>
                      ) : (
                        <span className="field-hint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Chưa có loại lỗi nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {(modal === 'create' || modal?.edit) && (
        <Modal title={modal === 'create' ? 'Thêm loại lỗi' : 'Sửa loại lỗi'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <Alert>{formError}</Alert>

            {daKhoa && (
              <div className="alert alert-warning">
                <strong>Loại lỗi này đã có dữ liệu nên chỉ được đổi tên.</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {suDung.so_bao_cao_gan_nhan > 0 && (
                    <li>{suDung.so_bao_cao_gan_nhan} báo cáo đang gán nhãn này.</li>
                  )}
                  {suDung.so_bao_cao_chi_tiet > 0 && (
                    <li>
                      {suDung.so_bao_cao_chi_tiet} báo cáo có hư bỏ chi tiết loại lỗi này (tổng{' '}
                      {formatSoLuong(suDung.tong_so_luong_chi_tiet)} sản phẩm).
                    </li>
                  )}
                  <li>Muốn dùng theo cách khác (mục đích, lỗi nội bộ), hãy tạo loại lỗi mới.</li>
                </ul>
              </div>
            )}

            <div className="form-grid form-grid-1">
              <VatTuFilterFields
                vatTuList={vatTuList}
                value={form.ma_vat_tu}
                onChange={(v) => setForm({ ...form, ma_vat_tu: v })}
                disabled={modal !== 'create'}
                allowClear={false}
              />
              <div className="field">
                <label>Tên lỗi</label>
                <input value={form.ten_loi} onChange={(e) => setForm({ ...form, ten_loi: e.target.value })} required />
              </div>
              <div className="field">
                <label>Mục đích dùng</label>
                <select
                  value={form.muc_dich}
                  onChange={(e) => setForm({ ...form, muc_dich: e.target.value })}
                  disabled={form.la_loi_noi_bo || daKhoa}
                >
                  <option value="gan_nhan">Gán nhãn (lỗi chuẩn cho báo cáo)</option>
                  <option value="tach_hu_bo">Tách hư bỏ (nhập số lượng chi tiết)</option>
                  <option value="ca_hai">Cả hai</option>
                </select>
                <span className="field-hint">
                  {daKhoa
                    ? 'Đã khóa vì loại lỗi này đã có dữ liệu.'
                    : form.la_loi_noi_bo
                      ? 'Lỗi nội bộ luôn khóa ở "Gán nhãn".'
                      : '"Tách hư bỏ" / "Cả hai" sẽ hiện ô nhập số lượng trong form báo cáo xử lý.'}
                </span>
              </div>
              <div className="field">
                <label className="check-inline">
                  <input
                    type="checkbox"
                    checked={form.la_loi_noi_bo}
                    disabled={daKhoa}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        la_loi_noi_bo: e.target.checked,
                        muc_dich: e.target.checked ? 'gan_nhan' : form.muc_dich,
                      })
                    }
                  />
                  Lỗi nội bộ
                </label>
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-16" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
