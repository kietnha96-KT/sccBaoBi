import { useEffect, useState } from 'react';
import { dashboardGioLamNgay } from '../api/dashboardApi';
import { formatSoLuong, todayStr } from '../format';
import { useFetch } from '../hooks/useFetch';
import { useRowSelect } from '../hooks/useRowSelect';
import { useCloseOnBackButton } from '../hooks/useCloseOnBackButton';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import SelectionActionBar from '../components/SelectionActionBar';
import SortableTh from '../components/SortableTh';
import GioLamNgayDetail from '../components/GioLamNgayDetail';

const gioText = (t) => (t ? t.substring(0, 5) : '—');

// Không phân trang (danh sách nhỏ, chỉ 1 ngày) -> sắp xếp ngay ở client, không cần gọi lại API.
function sapXep(rows, sortBy, sortDir) {
  if (!sortBy) return rows;
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const an = Number(av);
    const bn = Number(bv);
    if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') return (an - bn) * dir;
    return String(av).localeCompare(String(bv), 'vi') * dir;
  });
}

// Xem nhanh 1 ngày: mỗi nhân sự làm từ giờ nào tới giờ nào, suy ra từ báo cáo họ tham gia
// hôm đó (kể cả lựa lại). KHÔNG phải chấm công chính thức - xem ghi chú trong popup chi tiết.
export default function DashboardGioLamNgayPage() {
  const [ngay, setNgay] = useState(todayStr());
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const { selectedRowId, setSelectedRowId, getRowProps } = useRowSelect();
  const [viewRow, setViewRow] = useState(null);
  useCloseOnBackButton(!!viewRow, () => setViewRow(null));

  const { data, loading, error } = useFetch(() => dashboardGioLamNgay({ ngay }), [ngay]);
  const rows = sapXep(data?.data || [], sortBy, sortDir);
  const selectedRow = rows.find((r) => r.nhansu_id === selectedRowId) || null;

  function toggleSort(key) {
    setSortDir(sortBy === key && sortDir === 'asc' ? 'desc' : 'asc');
    setSortBy(key);
  }

  useEffect(() => {
    setSelectedRowId(null);
  }, [ngay, setSelectedRowId]);

  return (
    <div className={selectedRow ? 'has-selection-bar' : undefined}>
      <h1 className="page-title">Giờ làm nhân sự trong ngày</h1>
      <Alert>{error}</Alert>

      <div className="filter-bar">
        <div className="field">
          <label>Ngày</label>
          <input type="date" value={ngay} max={todayStr()} onChange={(e) => setNgay(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>
            Nhân sự ngày {new Date(ngay).toLocaleDateString('vi-VN')}
            <span className="field-hint h2-note">
              (xem nhanh theo báo cáo đã nhập, không phải chấm công chính thức)
            </span>
          </h2>
        </div>

        <SelectionActionBar
          selected={selectedRow}
          onClear={() => setSelectedRowId(null)}
          idleHint="Bấm vào một dòng để xem chi tiết từng báo cáo trong ngày"
          label={selectedRow && <strong>{selectedRow.ho_ten}</strong>}
          extra={
            selectedRow && (
              <>
                {selectedRow.gio_vao || selectedRow.gio_ra ? (
                  <>
                    <strong>{gioText(selectedRow.gio_vao)}</strong> - <strong>{gioText(selectedRow.gio_ra)}</strong>
                  </>
                ) : (
                  <span className="field-hint">Chưa có giờ</span>
                )}
                {' · '}
                {formatSoLuong(selectedRow.so_bao_cao)} báo cáo
              </>
            )
          }
        >
          <button className="btn btn-sm btn-primary" onClick={() => setViewRow(selectedRow)}>
            Xem
          </button>
        </SelectionActionBar>

        <div className="table-wrap">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh label="Nhân sự" sortKey="ho_ten" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Giờ vào" sortKey="gio_vao" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Giờ ra" sortKey="gio_ra" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Số báo cáo" sortKey="so_bao_cao" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.nhansu_id} {...getRowProps(r.nhansu_id)}>
                    <td>{r.ho_ten}</td>
                    {Number(r.so_bao_cao) === 0 ? (
                      <td colSpan={2}>
                        <span className="badge badge-muted">Không có báo cáo</span>
                      </td>
                    ) : (
                      <>
                        <td>
                          {r.gio_vao ? (
                            gioText(r.gio_vao)
                          ) : (
                            <span className="field-hint">chưa có giờ</span>
                          )}
                        </td>
                        <td>
                          {r.gio_ra ? gioText(r.gio_ra) : <span className="field-hint">chưa có giờ</span>}
                        </td>
                      </>
                    )}
                    <td>{formatSoLuong(r.so_bao_cao)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewRow && (
        <Modal title={`Chi tiết ngày ${new Date(ngay).toLocaleDateString('vi-VN')} - ${viewRow.ho_ten}`} onClose={() => setViewRow(null)} size="lg">
          <GioLamNgayDetail row={viewRow} ngay={ngay} />
          <div className="btn-group mt-16">
            <button type="button" className="btn" onClick={() => setViewRow(null)}>
              Đóng
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
