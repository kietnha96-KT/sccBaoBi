import { useEffect, useState } from 'react';
import { dashboardGioLamNgay } from '../api/dashboardApi';
import { formatSoLuong, todayStr } from '../format';
import { useFetch } from '../hooks/useFetch';
import { useRowSelect } from '../hooks/useRowSelect';
import { useCloseOnBackButton } from '../hooks/useCloseOnBackButton';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import SelectionActionBar from '../components/SelectionActionBar';
import GioLamNgayDetail from '../components/GioLamNgayDetail';

const gioText = (t) => (t ? t.substring(0, 5) : '—');

// Xem nhanh 1 ngày: mỗi nhân sự làm từ giờ nào tới giờ nào, suy ra từ báo cáo họ tham gia
// hôm đó (kể cả lựa lại). KHÔNG phải chấm công chính thức - xem ghi chú trong popup chi tiết.
export default function DashboardGioLamNgayPage() {
  const [ngay, setNgay] = useState(todayStr());
  const { selectedRowId, setSelectedRowId, getRowProps } = useRowSelect();
  const [viewRow, setViewRow] = useState(null);
  useCloseOnBackButton(!!viewRow, () => setViewRow(null));

  const { data, loading, error } = useFetch(() => dashboardGioLamNgay({ ngay }), [ngay]);
  const rows = data?.data || [];
  const selectedRow = rows.find((r) => r.nhansu_id === selectedRowId) || null;

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
                  <th>Nhân sự</th>
                  <th>Giờ vào</th>
                  <th>Giờ ra</th>
                  <th>Số báo cáo</th>
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
