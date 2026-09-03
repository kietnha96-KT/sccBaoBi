// Thanh hành động cho DÒNG ĐANG CHỌN trong bảng (thay cho cột nút Sửa/Xóa ở cuối bảng).
//  - PC: nằm ngay dưới card-header, trên bảng; luôn hiện (có gợi ý khi chưa chọn).
//  - Mobile: ghim đáy màn hình, chỉ hiện khi có dòng được chọn.
// Nhớ đặt class 'has-selection-bar' lên thẻ bọc ngoài của trang khi có dòng chọn
// (để chừa chỗ cho thanh cố định trên mobile).
//
// props:
//  - selected  : object dòng đang chọn (hoặc null)
//  - label     : mô tả dòng đang chọn (chuỗi / node)
//  - idleHint  : câu gợi ý khi chưa chọn (PC)
//  - onClear   : bỏ chọn
//  - children  : các nút hành động (Sửa / Xóa / ...)
export default function SelectionActionBar({ selected, label, idleHint, onClear, children }) {
  return (
    <div className={'selection-bar' + (selected ? ' active' : '')}>
      {selected ? (
        <>
          <span className="selection-bar-info">{label}</span>
          <div className="btn-group">
            {children}
            <button type="button" className="btn btn-sm" onClick={onClear}>
              Bỏ chọn
            </button>
          </div>
        </>
      ) : (
        <span className="field-hint">{idleHint || 'Bấm vào một dòng trong bảng để thao tác'}</span>
      )}
    </div>
  );
}
