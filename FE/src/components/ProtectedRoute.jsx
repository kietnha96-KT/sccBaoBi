import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children, adminOnly = false, staffOnly = false }) {
  const { user, isAdmin, isStaff } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/baocao" replace />;
  if (staffOnly && !isStaff) return <Navigate to="/baocao" replace />;

  return children;
}
