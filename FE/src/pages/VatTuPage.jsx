import { useState } from 'react';
import { listVatTu, listLoaiVatTu, createVatTu, updateVatTu, deleteVatTu } from '../api/vattuApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useRowSelect } from '../hooks/useRowSelect';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import TruncatedText from '../components/TruncatedText';
import ImportExcelButton from '../components/ImportExcelButton';

const PAGE_SIZE = 15;
const emptyForm = { ma_vat_tu: '', ten_vat_tu: '', loai: '', thu_kho: '' };

export default function VatTuPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loaiFilter, setLoaiFilter] = useState('');
  const { data, loading, error, reload } = useFetch(
    () => listVatTu({ page, limit: PAGE_SIZE, search: search || undefined, loai: loaiFilter || undefined }),
    [page, search, loaiFilter]
  );
  const { data: loaiOptions } = useFetch(listLoaiVatTu, []);
  const { getRowProps } = useRowSelect();

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
    setForm({
      ma_vat_tu: row.ma_vat_tu,
      ten_vat_tu: row.ten_vat_tu,
      loai: row.loai || '',
      thu_kho: row.thu_kho || '',
    });
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
        setPage(1);
      } else {
        await updateVatTu(modal.edit.ma_vat_tu, {
          ten_vat_tu: form.ten_vat_tu,
          loai: form.loai,
          thu_kho: form.thu_kho,
        });
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

  const rows = data?.data || [];

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Danh mục vật tư
      </h1>
      <Alert>{error}</Alert>

      <div className="filter-bar">
        <div className="field" style={{ minWidth: 240 }}>
          <label>Tìm kiếm</label>
          <input
            placeholder="Tìm theo mã hoặc tên vật tư..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {loaiOptions?.length > 0 && (
          <div className="field">
            <label>Loại</label>
            <select
              value={loaiFilter}
              onChange={(e) => {
                setLoaiFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              {loaiOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Danh sách vật tư {data?.pagination ? `(${data.pagination.total})` : ''}</h2>
          <div className="btn-group">
            <button className="btn btn-sm" onClick={() => downloadExcel('/vattu/export', {}, 'danh_muc_vat_tu.xlsx')}>
              Xuất Excel
            </button>
            <ImportExcelButton
              endpoint="/vattu/import"
              columnsHint="Mã vật tư, Tên vật tư, Loại, Thủ kho"
              onImported={reload}
            />
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
                  <th>Loại</th>
                  <th>Thủ kho</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.ma_vat_tu} {...getRowProps(row.ma_vat_tu)}>
                    <td>{row.ma_vat_tu}</td>
                    <td><TruncatedText text={row.ten_vat_tu} /></td>
                    <td>{row.loai || <span className="field-hint">Chưa gán</span>}</td>
                    <td>{row.thu_kho || <span className="field-hint">Chưa gán</span>}</td>
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
                    <td colSpan={5} className="empty-state">
                      {search || loaiFilter ? 'Không tìm thấy vật tư phù hợp' : 'Chưa có vật tư nào'}
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
              <div className="field">
                <label>Loại</label>
                <input
                  value={form.loai}
                  onChange={(e) => setForm({ ...form, loai: e.target.value })}
                  placeholder="Để trống nếu chưa phân loại"
                  list="loai-vat-tu-goi-y"
                />
                <datalist id="loai-vat-tu-goi-y">
                  {loaiOptions?.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label>Thủ kho</label>
                <input
                  value={form.thu_kho}
                  onChange={(e) => setForm({ ...form, thu_kho: e.target.value })}
                  placeholder="Để trống nếu chưa gán"
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
