import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const client = axios.create({ baseURL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!location.pathname.startsWith('/login')) {
        location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Lấy thông báo lỗi từ response backend, có fallback
export function getErrorMessage(err) {
  return err.response?.data?.message || err.message || 'Đã có lỗi xảy ra';
}

// Gửi 1 file Excel (File object) lên endpoint import, trả về JSON kết quả
export async function importExcel(url, file) {
  const res = await client.post(url, file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  return res.data;
}

// Tải file Excel từ 1 endpoint export, kích hoạt tải xuống trên trình duyệt
export async function downloadExcel(url, params, fileName) {
  const res = await client.get(url, { params, responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName || 'export.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export default client;
