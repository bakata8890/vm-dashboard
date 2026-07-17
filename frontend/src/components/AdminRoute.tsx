import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Protege rutas que requieren rol = admin.
 * NO renderiza hijos si el rol no corresponde — no es ocultamiento CSS.
 * Asume que ProtectedRoute ya validó la sesión (user != null).
 */
export function AdminRoute() {
  const user = useAuthStore((s) => s.user);

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
