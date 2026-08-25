import { useState } from 'react';
import { listLo, createLo, updateLo, deleteLo } from '../api/loApi';
import { listVatTu } from '../api/vattuApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import Modal from '../components/Modal';

const emptyForm = { so_lo: '', ma_vat_tu: '', ngay_san_xuat: '', so_luong_lo: 0 };

export default function LoPage() {
  const [filters, setFilters] = useState({ ma_vat_tu: '', so_lo: '' });
  const { data, loading, error, reload } = useFetch(() => listLo(filters), [filters.ma_vat_tu, filters.so_lo]);
  const { data: vatTuList } = useFetch(listVatTu, []);

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
        <div className="field">
          <label>Vật tư</label>
          <select value={filters.ma_vat_tu} onChange={(e) => setFilters({ ...filters, ma_vat_tu: e.target.value })}>
            <option value="">Tất cả</option>
            {vatTuList?.map((v) => (
              <option key={v.ma_vat_tu} value={v.ma_vat_tu}>
                {v.ma_vat_tu} - {v.ten_vat_tu}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Số lô</label>
          <input
            placeholder="Tìm số lô..."
            value={filters.so_lo}
            onChange={(e) => setFilters({ ...filters, so_lo: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Danh sách lô</h2>
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
                  <th>Số lô</th>
                  <th>Vật tư</th>
                  <th>Ngày SX</th>
                  <th>Số lượng lô</th>
                  <th>Đã lựa</th>
                  <th>Còn lại</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.map((row) => (
                  <tr key={row.id}>
                    <td>{row.so_lo}</td>
                    <td className="wrap">
                      {row.ma_vat_tu} - {row.ten_vat_tu}
                    </td>
                    <td>{row.ngay_san_xuat ? new Date(row.ngay_san_xuat).toLocaleDateString('vi-VN') : '-'}</td>
                    <td>{row.so_luong_lo}</td>
                    <td>{row.da_lua}</td>
                    <td>
                      <span className={`badge ${Number(row.con_lai) <= 0 ? 'badge-success' : 'badge-warning'}`}>
                        {row.con_lai}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
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
                {data?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      Chưa có lô nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
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
              <div className="field">
                <label>Vật tư</label>
                <select
                  value={form.ma_vat_tu}
                  onChange={(e) => setForm({ ...form, ma_vat_tu: e.target.value })}
                  required
                >
                  <option value="">-- Chọn vật tư --</option>
                  {vatTuList?.map((v) => (
                    <option key={v.ma_vat_tu} value={v.ma_vat_tu}>
                      {v.ma_vat_tu} - {v.ten_vat_tu}
                    </option>
                  ))}
                </select>
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
