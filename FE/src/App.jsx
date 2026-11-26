import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import BaoCaoListPage from './pages/BaoCaoListPage';
import BaoCaoFormPage from './pages/BaoCaoFormPage';
import VatTuPage from './pages/VatTuPage';
import LoPage from './pages/LoPage';
import LoaiLoiPage from './pages/LoaiLoiPage';
import NhanSuPage from './pages/NhanSuPage';
import NhaCungCapPage from './pages/NhaCungCapPage';
import DashboardNhanSuPage from './pages/DashboardNhanSuPage';
import DashboardVatTuPage from './pages/DashboardVatTuPage';
import DashboardLoPage from './pages/DashboardLoPage';
import DashboardBaoCongLoPage from './pages/DashboardBaoCongLoPage';
import DashboardHuBoPage from './pages/DashboardHuBoPage';
import DashboardGioLamNgayPage from './pages/DashboardGioLamNgayPage';
import KhoLichSuPage from './pages/KhoLichSuPage';

// Bản đồ kho kéo theo thư viện three.js (nặng) -> chỉ tải khi vào trang này, không làm chậm các trang còn lại
const BanDoKhoPage = lazy(() => import('./pages/BanDoKhoPage'));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/baocao" replace />} />
            <Route path="/doi-mat-khau" element={<ChangePasswordPage />} />

            <Route path="/baocao" element={<BaoCaoListPage />} />
            <Route path="/baocao/moi" element={<BaoCaoFormPage />} />
            <Route path="/baocao/:id/sua" element={<BaoCaoFormPage />} />

            <Route
              path="/dashboard/nhan-su"
              element={
                <ProtectedRoute staffOnly>
                  <DashboardNhanSuPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/vat-tu"
              element={
                <ProtectedRoute staffOnly>
                  <DashboardVatTuPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/lo"
              element={
                <ProtectedRoute staffOnly>
                  <DashboardLoPage />
                </ProtectedRoute>
              }
            />

            <Route path="/dashboard/bao-cong" element={<DashboardBaoCongLoPage />} />

            <Route
              path="/dashboard/hu-bo"
              element={
                <ProtectedRoute staffOnly>
                  <DashboardHuBoPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/gio-lam-ngay"
              element={
                <ProtectedRoute staffOnly>
                  <DashboardGioLamNgayPage />
                </ProtectedRoute>
              }
            />

            {/* Quản lý vị trí kho: mọi vai trò xem được; ghi (nhập/xuất/chuyển) chỉ admin + thủ kho, BE chặn bằng requireStaff */}
            <Route
              path="/kho/ban-do"
              element={
                <Suspense fallback={<div className="spinner-text">Đang tải bản đồ kho...</div>}>
                  <BanDoKhoPage />
                </Suspense>
              }
            />
            <Route path="/kho/lich-su" element={<KhoLichSuPage />} />

            <Route
              path="/vat-tu"
              element={
                <ProtectedRoute adminOnly>
                  <VatTuPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lo"
              element={
                <ProtectedRoute staffOnly>
                  <LoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loai-loi"
              element={
                <ProtectedRoute staffOnly>
                  <LoaiLoiPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nhan-su"
              element={
                <ProtectedRoute adminOnly>
                  <NhanSuPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nha-cung-cap"
              element={
                <ProtectedRoute adminOnly>
                  <NhaCungCapPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/baocao" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
