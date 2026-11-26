import { formatSoLuong } from '../format';

// Thẻ thông tin ô đang chọn trên bản đồ: vị trí, các lô đang chứa, nút Nhập / Xuất / Chuyển / Sửa (chỉ admin + thủ kho).
// detail: kết quả getViTri(code) { data, loading, error }
export default function KhoCellCard({ sel, detail, isStaff, inPop, onClose, onAction, onZoom, onOpenPop, onTop }) {
  const d = detail.data && detail.data.ma_vi_tri === sel.code ? detail.data : null;
  const lots = d?.lo || [];
  const dangTai = detail.loading || (!d && !detail.error);

  return (
    <div className="kho-card">
      <button type="button" className="kho-card-x" aria-label="Bỏ chọn" onClick={onClose}>
        ×
      </button>
      <b className="kho-card-code">{sel.code}</b>
      <span className="kho-m">
        Kệ {sel.ke} · Ô {sel.o} · Tầng {sel.tang}
        {sel.soSau > 1 ? ` · Sâu ${sel.sau}/${sel.soSau}` : ''}
        {sel.satLoiVao ? ' · sát lối vào' : ''}
      </span>

      <div className="kho-lots">
        {detail.error && <span className="kho-warn">{detail.error}</span>}
        {dangTai && !detail.error && <span className="kho-m">Đang tải...</span>}
        {!dangTai && !detail.error && lots.length === 0 && <span>Ô trống</span>}
        {lots.map((l) => (
          <div key={`${l.ma_vat_tu}|${l.so_lo}`} className="kho-lot">
            <div className="kho-lot-head">
              <b>{l.ma_vat_tu}</b> ·
              <b>{l.so_lo}</b>
            </div>
            {l.ten_vat_tu && <div className="kho-m kho-lot-name">{l.ten_vat_tu}</div>}
            <div>
              {l.so_luong === null ? <span className="kho-m">Chưa biết số lượng</span> : <>SL: <b>{formatSoLuong(l.so_luong)}</b></>}
            </div>
            {isStaff && (
              <div className="kho-lot-actions">
                <button type="button" className="btn btn-sm" onClick={() => onAction('xuat', l)}>Xuất</button>
                <button type="button" className="btn btn-sm" onClick={() => onAction('chuyen', l)}>Chuyển</button>
                <button type="button" className="btn btn-sm" onClick={() => onAction('dieu_chinh', l)}>Sửa SL</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {isStaff && (
        <button type="button" className="btn btn-primary btn-sm kho-card-add" onClick={() => onAction('nhap')}>
          + Nhập lô vào ô này
        </button>
      )}
      <div className="kho-card-links">
        {inPop ? (
          <button type="button" className="kho-link" onClick={onZoom}>Zoom vào ô này</button>
        ) : (
          <>
            <button type="button" className="kho-link" onClick={onOpenPop}>Xem chi tiết ô này</button>
            <button type="button" className="kho-link" onClick={onTop}>Nhìn từ trên xuống {sel.nhom ? 'cả nhóm này' : 'kệ này'}</button>
          </>
        )}
      </div>
    </div>
  );
}
