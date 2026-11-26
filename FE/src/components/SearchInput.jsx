import { useState } from 'react';

// Ô tìm kiếm có kính lúp bên trái, nút × bên phải để xóa nhanh (Esc cũng xóa), và (tùy chọn) danh sách gợi ý xổ xuống.
// Controlled: value / onChange(chuỗi mới) do trang quản lý (thường là filter trên URL, xem useUrlFilters).
// Gợi ý (không bắt buộc): suggestions = mảng chuỗi do TRANG tự lấy (thường từ API, có debounce), suggestionsTotal = tổng số
// mục khớp (để báo "còn N mục khác"), onPick(chuỗi) khi chọn 1 gợi ý (mặc định gọi onChange).
// Bàn phím: ↑ ↓ chọn, Enter nhận gợi ý đang chọn, Esc đóng gợi ý (Esc lần nữa xóa chữ).
export default function SearchInput({ id, value, onChange, placeholder, ariaLabel, suggestions, suggestionsTotal, onPick }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const list = suggestions || [];
  // Gợi ý duy nhất mà trùng đúng chữ đang gõ thì không cần hiện nữa
  const chiLaChinNo = list.length === 1 && list[0].toLowerCase() === value.trim().toLowerCase();
  const showList = open && !!value && list.length > 0 && !chiLaChinNo;
  const listId = id + '-goiy';

  function pick(v) {
    setOpen(false);
    setActive(-1);
    (onPick || onChange)(v);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown' && list.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % list.length);
    } else if (e.key === 'ArrowUp' && list.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? list.length - 1 : i - 1));
    } else if (e.key === 'Enter' && showList && active >= 0) {
      e.preventDefault();
      pick(list[active]);
    } else if (e.key === 'Escape') {
      if (showList) {
        e.preventDefault();
        setOpen(false);
      } else if (value) {
        e.preventDefault();
        onChange('');
      }
    }
  }

  return (
    <div className="search-input">
      <svg className="search-input-icon" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="M13 13l4 4" />
      </svg>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        role={suggestions ? 'combobox' : undefined}
        aria-expanded={suggestions ? showList : undefined}
        aria-controls={suggestions ? listId : undefined}
        aria-autocomplete={suggestions ? 'list' : undefined}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {value && (
        <button type="button" className="search-input-clear" aria-label="Xóa nội dung tìm kiếm" onClick={() => { onChange(''); setActive(-1); document.getElementById(id)?.focus(); }}>
          ×
        </button>
      )}
      {showList && (
        // onMouseDown chặn input mất focus trước khi kịp nhận cú bấm vào gợi ý
        <ul id={listId} className="search-input-list" role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {list.map((s, i) => (
            <li key={s} role="option" aria-selected={i === active} className={'search-input-item' + (i === active ? ' active' : '')} onClick={() => pick(s)}>
              {s}
            </li>
          ))}
          {suggestionsTotal > list.length && (
            <li className="search-input-more" role="presentation">Còn {suggestionsTotal - list.length} mục khác, gõ thêm để lọc</li>
          )}
        </ul>
      )}
    </div>
  );
}
