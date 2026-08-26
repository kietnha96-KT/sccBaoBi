import { useState } from 'react';

// Hiện văn bản dài, ban đầu chỉ chiếm khoảng maxWidth (cắt bằng CSS ellipsis, không cắt cứng
// theo số ký tự), bấm icon để xem/thu gọn toàn bộ - dùng cho các cột tên dài trong bảng
export default function TruncatedText({ text, maxLength = 20, maxWidth = 150 }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;
  if (text.length <= maxLength) return <>{text}</>;

  return (
    <span className="truncated-text">
      <span className={expanded ? undefined : 'truncated-text-clip'} style={expanded ? undefined : { maxWidth }}>
        {text}
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
