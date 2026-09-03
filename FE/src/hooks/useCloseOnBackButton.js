import { useEffect, useRef } from 'react';

// Khi 1 lớp phủ (modal) đang mở: bấm nút Back của trình duyệt / cử chỉ Back của Android
// sẽ ĐÓNG modal thay vì rời khỏi trang.
// Trên iOS standalone (không có nút Back) hook này vô hại - chỉ thêm/gỡ 1 entry lịch sử.
export function useCloseOnBackButton(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    let closedByBack = false;
    window.history.pushState({ sccModal: true }, '');

    const onPop = () => {
      closedByBack = true;
      onCloseRef.current?.();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      // Modal đóng KHÔNG phải do nút Back (đóng bằng nút / bấm nền) -> gỡ entry vừa push
      if (!closedByBack && window.history.state?.sccModal) {
        window.history.back();
      }
    };
  }, [isOpen]);
}
