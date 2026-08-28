import { useState } from 'react';
import { listNhanSu, createNhanSu, updateNhanSu, resetPassword, deleteNhanSu } from '../api/nhansuApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { PAGE_SIZE } from '../constants';

const emptyForm = { ho_ten: '', username: '', password: '', vai_tro: 'nhan_vien' };

const ROLE_BADGE = {
  admin: { cls: 'badge-admin', label: 'Admin' },
  thu_kho: { cls: 'badge-thukho', label: 'Thủ kho' },
  nhan_vien: { cls: 'badge-nhanvien', label: 'Nhân viên' },
};

export default function NhanSuPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useFetch(
    () => listNhanSu({ page, limit: PAGE_SIZE, search: search || undefined }),
    [page, search]
  );
  const [modal, setModal] = useState(null); // 'create' | { edit: row } | { reset: row }
  const [form, setForm] = useState(emptyForm);
  const [resetPwd, setResetPwd] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm(emptyForm);
    setFormError('');
    setModal('create');
  }

  function openEdit(row) {
    setForm({ ho_ten: row.ho_ten, vai_tro: row.vai_tro });
    setFormError('');
    setModal({ edit: row });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (modal === 'create') {
        await createNhanSu(form);
      } else if (modal?.edit) {
        await updateNhanSu(modal.edit.id, { ho_ten: form.ho_ten, vai_tro: form.vai_tro });
      }
      setModal(null);
      reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await resetPassword(modal.reset.id, resetPwd);
      setModal(null);
      setResetPwd('');
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!confirm(`Xóa nhân sự "${row.ho_ten}"?`)) return;
    try {
      await deleteNhanSu(row.id);
      reload();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Quản lý nhân sự
      </h1>
      <Alert>{error}</Alert>

      <div className="filter-bar">
        <div className="field" style={{ minWidth: 220 }}>
          <label>Tìm kiếm</label>
          <input
            placeholder="Tìm theo tên hoặc username..."
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
          <h2>Danh sách nhân sự {data?.pagination ? `(${data.pagination.total})` : ''}</h2>
          <div className="btn-group">
            <button className="btn btn-sm" onClick={() => downloadExcel('/nhansu/export', {}, 'danh_sach_nhan_su.xlsx')}>
              Xuất Excel
            </button>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + Tạo tài khoản
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
                  <th>ID</th>
                  <th>Họ tên</th>
                  <th>Username</th>
                  <th>Vai trò</th>
                  <th>Ngày tạo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.ho_ten}</td>
                    <td>{row.username}</td>
                    <td>
                      <span className={`badge ${(ROLE_BADGE[row.vai_tro] || ROLE_BADGE.nhan_vien).cls}`}>
                        {(ROLE_BADGE[row.vai_tro] || ROLE_BADGE.nhan_vien).label}
                      </span>
                    </td>
                    <td>{new Date(row.created_at).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => openEdit(row)}>
                          Sửa
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            setResetPwd('');
                            setFormError('');
                            setModal({ reset: row });
                          }}
                        >
                          Đặt lại MK
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
                    <td colSpan={6} className="empty-state">
                      {search ? 'Không tìm thấy nhân sự phù hợp' : 'Chưa có nhân sự nào'}
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
        <Modal title={modal === 'create' ? 'Tạo tài khoản nhân sự' : 'Sửa nhân sự'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit}>
            <Alert>{formError}</Alert>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field">
                <label>Họ tên</label>
                <input
                  value={form.ho_ten}
                  onChange={(e) => setForm({ ...form, ho_ten: e.target.value })}
                  required
                />
              </div>
              {modal === 'create' && (
                <>
                  <div className="field">
                    <label>Username</label>
                    <input
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Mật khẩu (tối thiểu 6 ký tự)</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      minLength={6}
                      required
                    />
                  </div>
                </>
              )}
              <div className="field">
                <label>Vai trò</label>
                <select value={form.vai_tro} onChange={(e) => setForm({ ...form, vai_tro: e.target.value })}>
                  <option value="nhan_vien">Nhân viên</option>
                  <option value="thu_kho">Thủ kho</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </form>
        </Modal>
      )}

      {modal?.reset && (
        <Modal title={`Đặt lại mật khẩu cho ${modal.reset.ho_ten}`} onClose={() => setModal(null)}>
          <form onSubmit={handleResetPassword}>
            <Alert>{formError}</Alert>
            <div className="field">
              <label>Mật khẩu mới (tối thiểu 6 ký tự)</label>
              <input
                type="password"
                value={resetPwd}
                onChange={(e) => setResetPwd(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
