import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../services/AuthContext.jsx';

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <main className="status-page"><p>Opening your little space…</p></main>;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
