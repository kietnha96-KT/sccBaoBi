import { useRef } from 'react';

// Ô nhập SỐ LƯỢNG (số nguyên) có tách nghìn ngay khi gõ: 1234567 -> "1.234.567".
//  - Hiển thị: type="text" + inputMode numeric, tự chèn dấu "." phân tách nghìn (chuẩn vi-VN).
//  - Model (value/onChange): luôn là CHUỖI chỉ gồm chữ số (vd "1234567"), để nơi dùng cứ
//    Number(form.xxx) như cũ. Giá trị vào có thể là "62.00" từ DB -> tự quy về số nguyên.
//  - Nhận mọi prop khác của <input> (disabled, required, placeholder, id...).
function toDigits(v) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return s.replace(/^0+(?=\d)/, '');
  const n = Number(s);
  if (Number.isFinite(n)) return n <= 0 ? (n === 0 ? '0' : '') : String(Math.trunc(n));
  return s.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

export default function NumberInput({ value, onChange, ...rest }) {
  const ref = useRef(null);
  const digits = toDigits(value);
  const display = digits === '' ? '' : Number(digits).toLocaleString('vi-VN');

  function handleChange(e) {
    const el = e.target;
    const digitsBeforeCaret = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/\D/g, '').length;
    const next = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    onChange(next);
    // đặt lại con trỏ theo SỐ CHỮ SỐ phía trước nó, sau khi React vẽ lại giá trị đã format
    requestAnimationFrame(() => {
      const node = ref.current;
      if (!node || document.activeElement !== node) return;
      let seen = 0;
      let pos = 0;
      for (; pos < node.value.length && seen < digitsBeforeCaret; pos++) {
        if (/\d/.test(node.value[pos])) seen += 1;
      }
      node.setSelectionRange(pos, pos);
    });
  }

  return (
    <input
      ref={ref}
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={display}
      onChange={handleChange}
    />
  );
}
