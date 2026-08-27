import { useState } from 'react';
import { listNhaCungCap, createNhaCungCap, updateNhaCungCap, deleteNhaCungCap } from '../api/nhacungcapApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { PAGE_SIZE } from '../constants';

const emptyForm = { ma_ncc: '', ten_ncc: '' };

export default function NhaCungCapPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useFetch(
    () => listNhaCungCap({ page, limit: PAGE_SIZE, search: search || undefined }),
    [page, search]
  );

  const [modal, setModal] = useState(null); // 'create' | { edit: row }
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm(emptyForm);
    setFormError('');
    setModal('create');
  }

  function openEdit(row) {
    setForm({ ma_ncc: row.ma_ncc, ten_ncc: row.ten_ncc });
    setFormError('');
    setModal({ edit: row });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (modal === 'create') {
        await createNhaCungCap(form);
        setPage(1);
      } else {
        await updateNhaCungCap(modal.edit.ma_ncc, { ten_ncc: form.ten_ncc });
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
    if (!confirm(`Xóa nhà cung cấp "${row.ten_ncc}"?`)) return;
    try {
      await deleteNhaCungCap(row.ma_ncc);
      reload();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }

  const rows = data?.data || [];

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Danh mục nhà cung cấp
      </h1>
      <Alert>{error}</Alert>

      <div className="filter-bar">
        <div className="field" style={{ minWidth: 240 }}>
          <label>Tìm kiếm</label>
          <input
            placeholder="Tìm theo mã hoặc tên nhà cung cấp..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Danh sách nhà cung cấp {data?.pagination ? `(${data.pagination.total})` : ''}</h2>
          <div className="btn-group">
            <button
              className="btn btn-sm"
              onClick={() => downloadExcel('/nhacungcap/export', {}, 'danh_muc_nha_cung_cap.xlsx')}
            >
              Xuất Excel
            </button>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + Thêm nhà cung cấp
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
                  <th>Mã nhà cung cấp</th>
                  <th>Tên nhà cung cấp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.ma_ncc}>
                    <td>{row.ma_ncc}</td>
                    <td className="wrap">{row.ten_ncc}</td>
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
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-state">
                      {search ? 'Không tìm thấy nhà cung cấp phù hợp' : 'Chưa có nhà cung cấp nào'}
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
        <Modal title={modal === 'create' ? 'Thêm nhà cung cấp' : 'Sửa nhà cung cấp'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <Alert>{formError}</Alert>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field">
                <label>Mã nhà cung cấp</label>
                <input
                  value={form.ma_ncc}
                  onChange={(e) => setForm({ ...form, ma_ncc: e.target.value })}
                  disabled={modal !== 'create'}
                  required
                />
              </div>
              <div className="field">
                <label>Tên nhà cung cấp</label>
                <input
                  value={form.ten_ncc}
                  onChange={(e) => setForm({ ...form, ten_ncc: e.target.value })}
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
