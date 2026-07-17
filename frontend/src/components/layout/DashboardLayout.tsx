import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

export function DashboardLayout({ children }: Props) {
  const role        = useAuthStore((s) => s.user?.role);
  const openVMForm  = useUiStore((s) => s.openVMForm);
  const navigate    = useNavigate();

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-text-primary">Máquinas Virtuales</h1>
          {/* Botón "Nueva VM": NO renderizado en DOM para cliente (SDD §14.1 + §15) */}
          {role === 'admin' && (
            <button
              onClick={() => {
                openVMForm('create', null);
                navigate('/vms/nueva');
              }}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              + Nueva VM
            </button>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
