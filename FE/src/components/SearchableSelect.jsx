import { useEffect, useMemo, useRef, useState } from 'react';

// Bỏ dấu tiếng Việt để so khớp tìm kiếm không phân biệt dấu (gõ "bang keo" vẫn ra "Băng keo")
function stripDiacritics(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Ô chọn kiểu combobox: gõ để lọc + vẫn chọn bằng dropdown, dùng khi danh sách quá dài
 * cho <select> thường (vật tư, lô...).
 *
 * options: mảng dữ liệu gốc bất kỳ
 * getValue(option) -> giá trị (vd ma_vat_tu, id)
 * getLabel(option) -> chuỗi hiển thị + dùng để tìm kiếm
 * value: giá trị đang chọn (khớp getValue)
 * onChange(value): value = '' khi bấm xóa/không chọn gì
 */
export default function SearchableSelect({
  options = [],
  getValue,
  getLabel,
  value,
  onChange,
  placeholder = 'Gõ để tìm...',
  allowClear = true,
  clearLabel = 'Tất cả',
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((o) => String(getValue(o)) === String(value)) || null,
    [options, value, getValue]
  );

  // Khi đóng: hiển thị nhãn của lựa chọn hiện tại. Khi mở: hiển thị đúng chữ người dùng đang gõ.
  // Tính trực tiếp lúc render (không dùng effect đồng bộ state) để tránh giá trị "trễ" 1 nhịp.
  const displayValue = open ? query : selectedOption ? getLabel(selectedOption) : '';

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = stripDiacritics(query.trim());
    const base = !q ? options : options.filter((o) => stripDiacritics(getLabel(o)).includes(q));
    return base.slice(0, 200); // giới hạn render để không giật lag khi danh sách rất dài
  }, [options, query, getLabel]);

  function openMenu() {
    setQuery('');
    setOpen(true);
    setHighlight(0);
  }

  function selectOption(option) {
    onChange(option ? String(getValue(option)) : '');
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      openMenu();
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) selectOption(filtered[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="searchable-select" ref={wrapRef}>
      <div className="searchable-select-input-wrap">
        <input
          value={displayValue}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={openMenu}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {allowClear && value && !disabled && (
          <button
            type="button"
            className="searchable-select-clear"
            aria-label="Xóa lựa chọn"
            onClick={() => selectOption(null)}
          >
            ×
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="searchable-select-menu">
          {allowClear && (
            <div
              className={'searchable-select-option' + (!value ? ' active' : '')}
              onMouseDown={() => selectOption(null)}
            >
              {clearLabel}
            </div>
          )}
          {filtered.map((o, i) => (
            <div
              key={getValue(o)}
              className={
                'searchable-select-option' +
                (String(getValue(o)) === String(value) ? ' active' : '') +
                (i === highlight ? ' highlight' : '')
              }
              onMouseDown={() => selectOption(o)}
              onMouseEnter={() => setHighlight(i)}
            >
              {getLabel(o)}
            </div>
          ))}
          {filtered.length === 0 && <div className="searchable-select-empty">Không tìm thấy</div>}
        </div>
      )}
    </div>
  );
}
