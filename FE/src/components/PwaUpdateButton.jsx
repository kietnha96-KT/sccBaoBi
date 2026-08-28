import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Bao lâu kiểm tra 1 lần xem có bản mới trên server (PWA mobile mở lâu không tự hỏi lại).
const CHECK_INTERVAL_MS = 60 * 1000;

// Nút nhỏ cạnh "Đăng xuất": chỉ hiện khi Service Worker phát hiện bản build mới.
// Bấm -> updateServiceWorker(true) gửi SKIP_WAITING cho SW mới rồi tự reload trang.
export default function PwaUpdateButton() {
  const [registration, setRegistration] = useState(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, reg) {
      setRegistration(reg || null);
    },
  });

  useEffect(() => {
    if (!registration) return undefined;
    const check = () => {
      registration.update().catch(() => {});
    };
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    // Kiểm tra ngay khi app quay lại foreground (mở lại từ màn hình chính điện thoại).
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [registration]);

  if (!needRefresh) return null;

  return (
    <button
      type="button"
      className="btn btn-sm btn-pwa-update"
      onClick={() => updateServiceWorker(true)}
      title="Có bản cập nhật mới, bấm để tải lại"
      aria-label="Có bản cập nhật mới, bấm để tải lại"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
