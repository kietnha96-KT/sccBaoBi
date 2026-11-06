import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/client';

// Gọi 1 hàm async lấy dữ liệu, tự quản lý loading/error, deps đổi thì fetch lại.
// reload() dùng để gọi lại thủ công sau khi tạo/sửa/xóa.
// reload({ silent: true }) -> nạp lại NHƯNG giữ nguyên data cũ hiển thị, không bật loading
//   (tránh bảng bị thay bằng spinner làm mất vị trí cuộn khi xóa / gán nhãn / lưu popup).
// Đây là pattern fetch-trong-effect kinh điển (chưa dùng React Query/SWR trong dự án này),
// nên cố tình tắt 2 rule mới của eslint-plugin-react-hooks vốn nhắm tới code dùng Suspense/Compiler.
//
// CHỐNG GHI ĐÈ KẾT QUẢ CŨ: deps đổi nhanh (đổi bộ lọc, chọn vật tư...) -> bắn nhiều yêu cầu song
// song, kết quả có thể về SAI THỨ TỰ (yêu cầu cũ về sau đè lên yêu cầu mới -> hiện dữ liệu của bộ
// lọc cũ). Mỗi lần fetch có 1 số thứ tự; chỉ kết quả của lần fetch MỚI NHẤT được ghi vào state.
// Cũng bỏ qua kết quả về sau khi component đã bị gỡ.
export function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const fetcherRef = useRef(fetcher);
  const silentRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    const silent = silentRef.current;
    silentRef.current = false;
    const requestId = ++requestIdRef.current;
    const conHieuLuc = () => requestId === requestIdRef.current;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!silent) setLoading(true);
    setError('');
    /* eslint-enable react-hooks/set-state-in-effect */
    fetcherRef.current()
      .then((res) => {
        if (conHieuLuc()) setData(res);
      })
      .catch((err) => {
        if (conHieuLuc()) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (conHieuLuc()) setLoading(false);
      });
    // Gỡ component / chạy lại effect: vô hiệu hóa kết quả của lần fetch này
    return () => {
      requestIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  const reload = useCallback((opts) => {
    silentRef.current = !!opts?.silent;
    setReloadToken((t) => t + 1);
  }, []);

  return { data, loading, error, reload, setData };
}
