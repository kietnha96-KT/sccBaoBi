import { useState } from 'react';
import { listVatTu, createVatTu, updateVatTu, deleteVatTu } from '../api/vattuApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import Modal from '../components/Modal';

export default function VatTuPage() {
  const { data, loading, error, reload } = useFetch(listVatTu, []);
  const [modal, setModal] = useState(null); // 'create' | { edit: row }
  const [form, setForm] = useState({ ma_vat_tu: '', ten_vat_tu: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm({ ma_vat_tu: '', ten_vat_tu: '' });
    setFormError('');
    setModal('create');
  }

  function openEdit(row) {
    setForm({ ma_vat_tu: row.ma_vat_tu, ten_vat_tu: row.ten_vat_tu });
    setFormError('');
    setModal({ edit: row });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (modal === 'create') {
        await createVatTu(form);
      } else {
        await updateVatTu(modal.edit.ma_vat_tu, { ten_vat_tu: form.ten_vat_tu });
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
    if (!confirm(`Xóa vật tư "${row.ten_vat_tu}"?`)) return;
    try {
      await deleteVatTu(row.ma_vat_tu);
      reload();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Danh mục vật tư
      </h1>
      <Alert>{error}</Alert>

      <div className="card">
        <div className="card-header">
          <h2>Danh sách vật tư</h2>
          <div className="btn-group">
            <button className="btn btn-sm" onClick={() => downloadExcel('/vattu/export', {}, 'danh_muc_vat_tu.xlsx')}>
              Xuất Excel
            </button>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + Thêm vật tư
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.map((row) => (
                  <tr key={row.ma_vat_tu}>
                    <td>{row.ma_vat_tu}</td>
                    <td className="wrap">{row.ten_vat_tu}</td>
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
                    <td colSpan={3} className="empty-state">
                      Chưa có vật tư nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(modal === 'create' || modal?.edit) && (
        <Modal title={modal === 'create' ? 'Thêm vật tư' : 'Sửa vật tư'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <Alert>{formError}</Alert>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field">
                <label>Mã vật tư</label>
                <input
                  value={form.ma_vat_tu}
                  onChange={(e) => setForm({ ...form, ma_vat_tu: e.target.value })}
                  disabled={modal !== 'create'}
                  required
                />
              </div>
              <div className="field">
                <label>Tên vật tư</label>
                <input
                  value={form.ten_vat_tu}
                  onChange={(e) => setForm({ ...form, ten_vat_tu: e.target.value })}
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
