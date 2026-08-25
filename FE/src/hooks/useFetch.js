import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/client';

// Gọi 1 hàm async lấy dữ liệu, tự quản lý loading/error, deps đổi thì fetch lại.
// reload() dùng để gọi lại thủ công sau khi tạo/sửa/xóa.
// Đây là pattern fetch-trong-effect kinh điển (chưa dùng React Query/SWR trong dự án này),
// nên cố tình tắt 2 rule mới của eslint-plugin-react-hooks vốn nhắm tới code dùng Suspense/Compiler.
export function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');
    fetcherRef.current()
      .then((res) => setData(res))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return { data, loading, error, reload, setData };
}
