import { useState, useCallback } from 'react';
import * as authApi from '../api/authApi';
import { AuthContext } from './authContextObject';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback(async (username, password) => {
    const { token, user: u } = await authApi.login(username, password);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const isAdmin = user?.vai_tro === 'admin';
  const isThuKho = user?.vai_tro === 'thu_kho';
  // Nhóm "quyền như admin" (admin + thủ kho): dashboard, thao tác báo cáo,
  // danh mục Lô + Loại lỗi. Các danh mục còn lại vẫn chỉ admin.
  const isStaff = isAdmin || isThuKho;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isThuKho, isStaff }}>
      {children}
    </AuthContext.Provider>
  );
}
