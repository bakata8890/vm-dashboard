import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthSkeleton } from '@/components/AuthSkeleton';

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <AuthSkeleton />;

  // Sin sesión → /login. Navigate reemplaza la entrada en el historial
  // para que el botón "atrás" no vuelva a una ruta privada.
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
