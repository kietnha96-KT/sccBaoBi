import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children, adminOnly = false, staffOnly = false, xuLyHang = false }) {
  const { user, isAdmin, isStaff, khongXuLyHang } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/baocao" replace />;
  if (staffOnly && !isStaff) return <Navigate to="/baocao" replace />;
  if (xuLyHang && khongXuLyHang) return <Navigate to="/xin-nghi" replace />;

  return children;
}
