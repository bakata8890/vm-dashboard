import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminRoute } from '@/components/AdminRoute';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { useUiStore } from '@/store/uiStore';

const queryClient = new QueryClient();

function DarkModeSync() {
  const darkMode = useUiStore((s) => s.darkMode);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  return null;
}

// Abre el modal de crear y redirige al dashboard.
// Permite abrir el modal tanto por click como por URL directa (QA).
function OpenCreateModal() {
  const navigate   = useNavigate();
  const openVMForm = useUiStore((s) => s.openVMForm);
  useEffect(() => {
    openVMForm('create', null);
    navigate('/dashboard', { replace: true });
  }, [navigate, openVMForm]);
  return null;
}

function OpenEditModal() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const openVMForm = useUiStore((s) => s.openVMForm);
  useEffect(() => {
    if (id) openVMForm('edit', id);
    navigate('/dashboard', { replace: true });
  }, [id, navigate, openVMForm]);
  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DarkModeSync />
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route element={<AdminRoute />}>
              <Route path="/vms/nueva"          element={<OpenCreateModal />} />
              <Route path="/vms/:id/editar"     element={<OpenEditModal />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
