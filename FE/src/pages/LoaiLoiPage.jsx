import { useState } from 'react';
import { listLoaiLoi, createLoaiLoi, updateLoaiLoi, deleteLoaiLoi } from '../api/loailoiApi';
import { listVatTu } from '../api/vattuApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import TruncatedText from '../components/TruncatedText';
import VatTuFilterFields from '../components/VatTuFilterFields';
import { ALL_LIMIT, PAGE_SIZE } from '../constants';

export default function LoaiLoiPage() {
  const [page, setPage] = useState(1);
  const [maVatTuFilter, setMaVatTuFilter] = useState('');
  const { data, loading, error, reload } = useFetch(
    () => listLoaiLoi({ ma_vat_tu: maVatTuFilter || undefined, page, limit: PAGE_SIZE }),
    [maVatTuFilter, page]
  );
  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;

  function handleFilterChange(v) {
    setMaVatTuFilter(v);
    setPage(1);
  }

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ ma_vat_tu: '', ten_loi: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm({ ma_vat_tu: maVatTuFilter || '', ten_loi: '' });
    setFormError('');
    setModal('create');
  }

  function openEdit(row) {
    setForm({ ma_vat_tu: row.ma_vat_tu, ten_loi: row.ten_loi });
    setFormError('');
    setModal({ edit: row });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (modal === 'create') {
        await createLoaiLoi(form);
      } else {
        await updateLoaiLoi(modal.edit.id, { ten_loi: form.ten_loi });
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
    if (!confirm(`Xóa loại lỗi "${row.ten_loi}"?`)) return;
    try {
      await deleteLoaiLoi(row.id);
      reload();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Danh mục loại lỗi
      </h1>
      <Alert>{error}</Alert>

      <div className="filter-bar">
        <VatTuFilterFields vatTuList={vatTuList} value={maVatTuFilter} onChange={handleFilterChange} />
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Danh sách loại lỗi {data?.pagination ? `(${data.pagination.total})` : ''}</h2>
          <div className="btn-group">
            <button className="btn btn-sm" onClick={() => downloadExcel('/loailoi/export', {}, 'danh_muc_loi.xlsx')}>
              Xuất Excel
            </button>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + Thêm loại lỗi
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
                  <th>Tên lỗi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.ma_vat_tu}</td>
                    <td><TruncatedText text={row.ten_vat_tu} /></td>
                    <td><TruncatedText text={row.ten_loi} maxWidth={220} /></td>
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
                    <td colSpan={3} className="empty-state">
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
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
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
