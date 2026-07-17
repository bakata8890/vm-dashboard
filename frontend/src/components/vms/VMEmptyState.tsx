import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

export function VMEmptyState() {
  const role = useAuthStore((s) => s.user?.role);
  const openVMForm = useUiStore((s) => s.openVMForm);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-6xl select-none">🖥️</div>
      {role === 'admin' ? (
        <>
          <p className="mb-2 text-lg font-semibold text-text-primary">No hay VMs todavía</p>
          <p className="mb-6 text-sm text-text-secondary">Crea tu primera VM para comenzar.</p>
          <button
            onClick={() => openVMForm('create', null)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            Crear primera VM
          </button>
        </>
      ) : (
        <>
          <p className="mb-2 text-lg font-semibold text-text-primary">No hay VMs disponibles</p>
          <p className="text-sm text-text-secondary">Contacta al administrador para solicitar recursos.</p>
        </>
      )}
    </div>
  );
}
