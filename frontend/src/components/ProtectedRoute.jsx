import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../services/AuthContext.jsx';

export function ProtectedRoute() {
  const { user, loading, configured } = useAuth();
  const location = useLocation();
  if (loading) return <main className="status-page"><p>Opening your little space…</p></main>;
  if (!configured) return <main className="status-page"><h1>A little setup first</h1><p>Add your new Supabase URL and publishable key to the local environment file to enable sign in.</p></main>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
