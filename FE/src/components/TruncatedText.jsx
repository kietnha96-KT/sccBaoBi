import { useState } from 'react';

// Hiện văn bản dài, ban đầu chỉ chiếm khoảng maxWidth (cắt bằng CSS ellipsis, không cắt cứng
// theo số ký tự), bấm icon kính lúp để xem/thu gọn toàn bộ - dùng cho các cột tên dài trong bảng.
// fallback: nội dung hiển thị khi text rỗng (vd <span className="field-hint">Chưa có</span>).
export default function TruncatedText({ text, maxLength = 20, maxWidth = 150, fallback = null }) {
  const [expanded, setExpanded] = useState(false);

  if (text === null || text === undefined || text === '') return fallback;
  const str = String(text);
  if (str.length <= maxLength) return <>{str}</>;

  return (
    <span className="truncated-text">
      <span
        className={expanded ? undefined : 'truncated-text-clip'}
        style={expanded ? undefined : { maxWidth }}
      >
        {str}
      </span>
      <button
        type="button"
        className="truncated-text-toggle"
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? 'Thu gọn' : 'Xem đầy đủ'}
        aria-label={expanded ? 'Thu gọn' : 'Xem đầy đủ'}
      >
        {expanded ? '−' : '🔍'}
      </button>
    </span>
  );
}
