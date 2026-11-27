import { tongHopXinNghi } from '../api/xinNghiApi';
import { downloadExcel, getErrorMessage } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { todayStr } from '../format';
import Alert from '../components/Alert';

const so = (v) => (Number(v) ? Number(v).toLocaleString('vi-VN') : '-');

const COT = [
  { key: 'phep_ngay', label: 'Phép (ngày)' },
  { key: 'om_ngay', label: 'Ốm (ngày)' },
  { key: 'che_do_nu', label: 'Chế độ nữ' },
  { key: 'di_tre', label: 'Đi trễ' },
  { key: 've_som', label: 'Về sớm' },
  { key: 'quen_cham_cong', label: 'Quên chấm công' },
];

// Số người ít (1 công ty), không phân trang. Admin và thủ kho thấy mọi người, nhân viên chỉ thấy của mình (BE lọc).
export default function XinNghiTongHopPage() {
  const { filters, updateFilter } = useUrlFilters({ thang: '' });
  const thang = filters.thang || todayStr().slice(0, 7);
  const { data, loading, error } = useFetch(() => tongHopXinNghi({ thang }), [thang]);
  const rows = data?.data || [];
  const choDuyet = rows.reduce((s, r) => s + r.cho_duyet, 0);

  function xuatExcel() {
    downloadExcel('/xin-nghi/tong-hop/export', { thang }, `xin_nghi_${thang}.xlsx`).catch((err) =>
      alert(getErrorMessage(err))
    );
  }

  return (
    <div>
      <h1 className="page-title">Tổng hợp xin nghỉ theo tháng</h1>
      <Alert>{error}</Alert>
      {choDuyet > 0 && (
        <Alert type="warning">
          Còn <strong>{choDuyet}</strong> ngày đang chờ duyệt, chưa được cộng vào bảng dưới.
        </Alert>
      )}

      <div className="filter-bar">
        <div className="field">
          <label>Tháng</label>
          <input type="month" value={thang} onChange={(e) => updateFilter({ thang: e.target.value })} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>
            Tháng {thang.slice(5, 7)}/{thang.slice(0, 4)}
            <span className="field-hint h2-note">(chỉ cộng đơn đã duyệt)</span>
          </h2>
          <button className="btn btn-sm" onClick={xuatExcel}>
            Xuất Excel
          </button>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  {COT.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th>Chờ duyệt (ngày)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.nhansu_id}>
                    <td>{r.ho_ten}</td>
                    {COT.map((c) => (
                      <td key={c.key}>{so(r[c.key])}</td>
                    ))}
                    <td>{r.cho_duyet ? <span className="badge badge-warning">{r.cho_duyet}</span> : '-'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={COT.length + 2} className="empty-state">
                      Chưa có nhân viên nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
