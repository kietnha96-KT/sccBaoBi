const GIO_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const PHUT_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// Dropdown chọn giờ:phút theo định dạng 24h. Giá trị giữ trong form vẫn là chuỗi "HH:MM" (hoặc "").
// Chọn 1 trong 2 ô -> ô còn lại tự lấy "00". Nút "Bỏ giờ" để xóa trắng cả cặp.
export default function TimeSelect({ label, value, onChange, disabled, required }) {
  const [h, m] = value && value.includes(':') ? value.split(':') : ['', ''];
  const setPart = (nh, nm) => {
    if (!nh && !nm) return onChange('');
    onChange(`${nh || '00'}:${nm || '00'}`);
  };
  return (
    <div className="field">
      <label>
        {label}
        {required && <span className="req">*</span>}
      </label>
      <div className="time-row">
        <select value={h} onChange={(e) => setPart(e.target.value, m)} disabled={disabled} aria-label={`${label} - giờ`}>
          <option value="">Giờ</option>
          {GIO_OPTIONS.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <span>:</span>
        <select value={m} onChange={(e) => setPart(h, e.target.value)} disabled={disabled} aria-label={`${label} - phút`}>
          <option value="">Phút</option>
          {PHUT_OPTIONS.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        {value && !disabled && !required && (
          <button type="button" className="btn btn-sm" onClick={() => onChange('')}>
            Bỏ giờ
          </button>
        )}
      </div>
    </div>
  );
}
