import { useState } from 'react';
import { formatSoLuong } from '../format';
import { useRowSelect } from '../hooks/useRowSelect';
import { listLo, createLo, updateLo, deleteLo } from '../api/loApi';
import { listVatTu } from '../api/vattuApi';
import { listNhaCungCap } from '../api/nhacungcapApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import TruncatedText from '../components/TruncatedText';
import VatTuFilterFields from '../components/VatTuFilterFields';
import SearchableSelect from '../components/SearchableSelect';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';
import { nccValue, nccLabel } from '../selectHelpers';

const emptyForm = { so_lo: '', ma_vat_tu: '', ngay_san_xuat: '', so_luong_lo: 0, ma_ncc: '' };

export default function LoPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ma_vat_tu: '', so_lo: '' });
  const { data, loading, error, reload } = useFetch(
    () => listLo({ ...filters, page, limit: PAGE_SIZE }),
    [filters.ma_vat_tu, filters.so_lo, page]
  );
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  const { data: nccData } = useFetch(() => listNhaCungCap({ limit: ALL_LIMIT }), []);
  const nccList = nccData?.data || [];
  const { getRowProps } = useRowSelect();

  function updateFilters(patch) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm(emptyForm);
    setFormError('');
    setModal('create');
  }

  function openEdit(row) {
    setForm({
      so_lo: row.so_lo,
      ma_vat_tu: row.ma_vat_tu,
      ma_ncc: row.ma_ncc || '',
      ngay_san_xuat: row.ngay_san_xuat ? row.ngay_san_xuat.substring(0, 10) : '',
      so_luong_lo: row.so_luong_lo,
    });
    setFormError('');
    setModal({ edit: row });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = { ...form, so_luong_lo: Number(form.so_luong_lo) };
      if (modal === 'create') {
        await createLo(payload);
      } else {
        await updateLo(modal.edit.id, payload);
      }
      setModal(null);
      reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!confirm(`Xóa lô "${row.so_lo}"?`)) return;
    try {
      await deleteLo(row.id);
      reload();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Danh mục lô
      </h1>
      <Alert>{error}</Alert>

      <div className="filter-bar">
        <VatTuFilterFields
          vatTuList={vatTuList}
          value={filters.ma_vat_tu}
          onChange={(v) => updateFilters({ ma_vat_tu: v })}
        />
        <div className="field">
          <label>Số lô</label>
          <input
            placeholder="Tìm số lô..."
            value={filters.so_lo}
            onChange={(e) => updateFilters({ so_lo: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Danh sách lô {data?.pagination ? `(${data.pagination.total})` : ''}</h2>
          <div className="btn-group">
            <button className="btn btn-sm" onClick={() => downloadExcel('/lo/export', {}, 'danh_sach_lo.xlsx')}>
              Xuất Excel
            </button>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + Thêm lô
            </button>
          </div>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã vật tư</th>
                  <th>Tên vật tư</th>
                  <th>Số lô</th>
                  {/* <th>Ngày SX</th> */}
                  <th>Nhà cung cấp</th>
                  <th>Số lượng lô</th>
                  <th>Đã lựa</th>
                  <th>Còn lại</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row) => (
                  <tr key={row.id} {...getRowProps(row.id)}>
                    <td>{row.ma_vat_tu}</td>
                    <td><TruncatedText text={row.ten_vat_tu} /></td>
                    <td>{row.so_lo}</td>
                    {/* <td>{row.ngay_san_xuat ? new Date(row.ngay_san_xuat).toLocaleDateString('vi-VN') : '-'}</td> */}
                    <td><TruncatedText text={row.ten_ncc} fallback={<span className="field-hint">Chưa có</span>} /></td>
                    <td>{formatSoLuong(row.so_luong_lo)}</td>
                    <td>
                      <div>{formatSoLuong(row.da_lua)}</div>
                      {(Number(row.da_lua_gan_ron) > 0 || Number(row.da_lua_cat_ty) > 0) && (
                        <div className="field-hint" style={{ fontSize: 11, lineHeight: 1.5 }}>
                          {Number(row.da_lua_gan_ron) > 0 && (
                            <div>Gắn ron: {formatSoLuong(row.da_lua_gan_ron)}</div>
                          )}
                          {Number(row.da_lua_cat_ty) > 0 && (
                            <div>Cắt ty: {formatSoLuong(row.da_lua_cat_ty)}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${Number(row.con_lai) <= 0 ? 'badge-success' : 'badge-warning'}`}>
                        {formatSoLuong(row.con_lai)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => openEdit(row)}>
                          Sửa
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(row)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      Chưa có lô nào
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
        <Modal title={modal === 'create' ? 'Thêm lô' : 'Sửa lô'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <Alert>{formError}</Alert>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field">
                <label>Số lô</label>
                <input value={form.so_lo} onChange={(e) => setForm({ ...form, so_lo: e.target.value })} required />
              </div>
              <VatTuFilterFields
                vatTuList={vatTuList}
                value={form.ma_vat_tu}
                onChange={(v) => setForm({ ...form, ma_vat_tu: v })}
                allowClear={false}
              />
              <div className="field">
                <label>Nhà cung cấp</label>
                <SearchableSelect
                  options={nccList}
                  getValue={nccValue}
                  getLabel={nccLabel}
                  value={form.ma_ncc}
                  onChange={(v) => setForm({ ...form, ma_ncc: v })}
                  placeholder="Gõ để tìm, để trống nếu chưa có..."
                  clearLabel="Chưa có nhà cung cấp"
                />
              </div>
              <div className="field">
                <label>Ngày sản xuất</label>
                <input
                  type="date"
                  value={form.ngay_san_xuat}
                  onChange={(e) => setForm({ ...form, ngay_san_xuat: e.target.value })}
                />
              </div>
              
              <div className="field">
                <label>Số lượng lô</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.so_luong_lo}
                  onChange={(e) => setForm({ ...form, so_luong_lo: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
