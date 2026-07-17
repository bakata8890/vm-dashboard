import { useEffect, useRef } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useVMs } from '@/hooks/useVMs';
import { VMForm } from '@/components/vms/VMForm';

export function VMFormModal() {
  // Todos los hooks antes de cualquier condicional (lección módulo 1)
  const vmFormMode  = useUiStore((s) => s.vmFormMode);
  const selectedVMId = useUiStore((s) => s.selectedVMId);
  const closeVMForm  = useUiStore((s) => s.closeVMForm);
  const { data: vms = [] } = useVMs();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (vmFormMode) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [vmFormMode]);

  const editingVM =
    vmFormMode === 'edit' && selectedVMId
      ? (vms.find((vm) => vm.id === selectedVMId) ?? null)
      : null;

  const title = vmFormMode === 'create' ? 'Nueva VM' : 'Editar VM';

  return (
    <dialog
      ref={dialogRef}
      onClose={closeVMForm}
      className="w-full max-w-lg rounded-xl border border-border bg-surface-raised p-6 shadow-xl"
    >
      {vmFormMode && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <button
              onClick={closeVMForm}
              aria-label="Cerrar"
              className="rounded p-1 text-text-secondary transition-colors hover:bg-surface"
            >
              ✕
            </button>
          </div>
          <VMForm
            mode={vmFormMode}
            initialValues={editingVM}
            onClose={closeVMForm}
          />
        </>
      )}
    </dialog>
  );
}
