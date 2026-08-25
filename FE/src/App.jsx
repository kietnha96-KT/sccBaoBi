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
import DashboardNhanSuPage from './pages/DashboardNhanSuPage';
import DashboardVatTuPage from './pages/DashboardVatTuPage';
import DashboardLoPage from './pages/DashboardLoPage';
import DashboardThoiGianPage from './pages/DashboardThoiGianPage';

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
                <ProtectedRoute adminOnly>
                  <DashboardNhanSuPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/vat-tu"
              element={
                <ProtectedRoute adminOnly>
                  <DashboardVatTuPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/lo"
              element={
                <ProtectedRoute adminOnly>
                  <DashboardLoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/thoi-gian"
              element={
                <ProtectedRoute adminOnly>
                  <DashboardThoiGianPage />
                </ProtectedRoute>
              }
            />

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
                <ProtectedRoute adminOnly>
                  <LoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loai-loi"
              element={
                <ProtectedRoute adminOnly>
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
          </Route>

          <Route path="*" element={<Navigate to="/baocao" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
