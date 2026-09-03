// size: 'lg' -> modal rộng hơn (dùng cho form nhiều cột như form báo cáo)
export default function Modal({ title, onClose, children, size }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={'modal-box card' + (size === 'lg' ? ' modal-lg' : '')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}
