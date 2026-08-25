import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listBaoCao, deleteBaoCao, ganLoiChuan } from '../api/baocaoApi';
import { listVatTu } from '../api/vattuApi';
import { listLoaiLoi } from '../api/loailoiApi';
import { listNhanSu } from '../api/nhansuApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../hooks/useAuth';
import Alert from '../components/Alert';

const emptyFilters = {
  tu_ngay: '',
  den_ngay: '',
  ma_vat_tu: '',
  la_lua_lai: '',
  nguoi_nhap_id: '',
  nhansu_id: '',
  page: 1,
  limit: 20,
};

export default function BaoCaoListPage() {
  const { user, isAdmin } = useAuth();
  const [filters, setFilters] = useState(emptyFilters);
  const [actionError, setActionError] = useState('');

  const { data, loading, error, reload } = useFetch(
    () => listBaoCao(cleanParams(filters)),
    [
      filters.tu_ngay,
      filters.den_ngay,
      filters.ma_vat_tu,
      filters.la_lua_lai,
      filters.nguoi_nhap_id,
      filters.nhansu_id,
      filters.page,
      filters.limit,
    ]
  );
  const { data: vatTuList } = useFetch(listVatTu, []);
  const { data: loaiLoiList } = useFetch(listLoaiLoi, []);
  const { data: nhanSuList } = useFetch(listNhanSu, []);

  function cleanParams(f) {
    const p = { page: f.page, limit: f.limit };
    if (f.tu_ngay) p.tu_ngay = f.tu_ngay;
    if (f.den_ngay) p.den_ngay = f.den_ngay;
    if (f.ma_vat_tu) p.ma_vat_tu = f.ma_vat_tu;
    if (f.la_lua_lai !== '') p.la_lua_lai = f.la_lua_lai;
    if (f.nguoi_nhap_id) p.nguoi_nhap_id = f.nguoi_nhap_id;
    if (f.nhansu_id) p.nhansu_id = f.nhansu_id;
    return p;
  }

  function updateFilter(patch) {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  async function handleDelete(row) {
    if (!confirm(`Xóa báo cáo #${row.id}?`)) return;
    setActionError('');
    try {
      await deleteBaoCao(row.id);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  async function handleGanLoi(row, loiChuanId) {
    setActionError('');
    try {
      await ganLoiChuan(row.id, loiChuanId || null);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  const pagination = data?.pagination;

  return (
    <div>
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
        <div className="field">
          <label>Vật tư</label>
          <select value={filters.ma_vat_tu} onChange={(e) => updateFilter({ ma_vat_tu: e.target.value })}>
            <option value="">Tất cả</option>
            {vatTuList?.map((v) => (
              <option key={v.ma_vat_tu} value={v.ma_vat_tu}>
                {v.ma_vat_tu} - {v.ten_vat_tu}
              </option>
            ))}
          </select>
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
          <button type="button" className="btn" onClick={() => setFilters(emptyFilters)}>
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
            <Link to="/baocao/moi" className="btn btn-primary btn-sm">
              + Nhập báo cáo
            </Link>
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
                  <th>Ngày</th>
                  <th>Số lô</th>
                  <th>Vật tư</th>
                  <th>Đạt</th>
                  <th>Hư bỏ</th>
                  <th>Tổng lựa</th>
                  <th>Người nhập</th>
                  <th>Nhân sự tham gia</th>
                  <th>Lỗi (tự do)</th>
                  <th>Lựa lại</th>
                  {isAdmin && <th>Lỗi chuẩn (admin gán)</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{new Date(row.ngay).toLocaleDateString('vi-VN')}</td>
                    <td>{row.so_lo}</td>
                    <td className="wrap">
                      {row.ma_vat_tu} - {row.ten_vat_tu}
                    </td>
                    <td>{row.dat}</td>
                    <td>{row.hu_bo}</td>
                    <td>{row.tong_lua}</td>
                    <td>{row.nguoi_nhap_ho_ten}</td>
                    <td className="wrap">{row.nhansu_tham_gia.map((n) => n.ho_ten).join(', ')}</td>
                    <td className="wrap">{row.loi_nguoi_dung || '-'}</td>
                    <td>
                      {row.la_lua_lai ? (
                        <span className="badge badge-warning">Lựa lại</span>
                      ) : (
                        <span className="badge badge-muted">Lựa chính</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <select
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
                      <div className="btn-group">
                        {row.co_the_sua_xoa_hom_nay || isAdmin ? (
                          <>
                            <Link to={`/baocao/${row.id}/sua`} className="btn btn-sm">
                              Sửa
                            </Link>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(row)}>
                              Xóa
                            </button>
                          </>
                        ) : (
                          <span className="field-hint">Đã khóa</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={13} className="empty-state">
                      Không có báo cáo nào khớp bộ lọc
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {pagination && pagination.total_pages > 1 && (
          <div className="pagination" style={{ padding: '0 20px 16px' }}>
            <button
              className="btn btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => updateFilter({ page: pagination.page - 1 })}
            >
              Trước
            </button>
            <span>
              Trang {pagination.page}/{pagination.total_pages}
            </span>
            <button
              className="btn btn-sm"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => updateFilter({ page: pagination.page + 1 })}
            >
              Sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
