import { useRef, useState } from 'react';
import { importExcel, getErrorMessage } from '../api/client';
import Modal from './Modal';
import Alert from './Alert';

// Nút "Nhập Excel" dùng chung cho các trang quản trị danh mục.
// props:
//  - endpoint : đường dẫn API import, vd '/vattu/import'
//  - columnsHint : mô tả các cột file cần có (hiện trong hộp thoại)
//  - onImported : gọi lại sau khi đóng kết quả (thường là reload bảng)
export default function ImportExcelButton({ endpoint, columnsHint, onImported }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { tong_dong, them_moi, nhom_bo_qua }
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // để chọn lại cùng 1 file vẫn kích hoạt
    if (!file) return;

    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await importExcel(endpoint, file);
      setResult(res);
    } catch (err) {
      setError(getErrorMessage(err));
      setResult({}); // mở modal để hiện lỗi
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setResult(null);
    setError('');
    onImported?.();
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-sm"
        disabled={busy}
        title={columnsHint ? `File .xlsx, dòng đầu là tiêu đề cột: ${columnsHint}` : undefined}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Đang nạp...' : 'Nhập Excel'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {result && (
        <Modal title="Kết quả nạp Excel" onClose={close}>
          <Alert>{error}</Alert>

          {!error && (
            <>
              {columnsHint && (
                <p className="field-hint" style={{ margin: '0 0 8px' }}>
                  Cột đọc từ file: {columnsHint}
                </p>
              )}
              <p style={{ margin: '0 0 12px' }}>
                Đọc <strong>{result.tong_dong ?? 0}</strong> dòng · Đã thêm mới{' '}
                <strong style={{ color: 'var(--success)' }}>{result.them_moi ?? 0}</strong> dòng.
              </p>

              {(result.nhom_bo_qua || []).map((g, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: g.muc === 'loi' ? 'var(--danger)' : 'var(--warning)',
                      marginBottom: 4,
                    }}
                  >
                    {g.tieu_de} ({g.danh_sach.length})
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-muted)' }}>
                    {g.danh_sach.slice(0, 100).map((r, k) => (
                      <li key={k}>
                        Dòng {r.dong}: {r.chi_tiet}
                      </li>
                    ))}
                    {g.danh_sach.length > 100 && <li>... và {g.danh_sach.length - 100} dòng nữa</li>}
                  </ul>
                </div>
              ))}

              {(result.nhom_bo_qua || []).length === 0 && (
                <p className="field-hint" style={{ margin: 0 }}>
                  Không có dòng nào bị bỏ qua.
                </p>
              )}
            </>
          )}

          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} onClick={close}>
            Xong
          </button>
        </Modal>
      )}
    </>
  );
}
