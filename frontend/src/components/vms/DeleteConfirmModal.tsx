import { useEffect, useRef } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useDeleteVM } from '@/hooks/useDeleteVM';
import { useVMs } from '@/hooks/useVMs';

export function DeleteConfirmModal() {
  // Todos los hooks antes de cualquier condicional (lección módulo 1)
  const deleteTargetId    = useUiStore((s) => s.deleteTargetId);
  const closeDeleteConfirm = useUiStore((s) => s.closeDeleteConfirm);
  const { data: vms = [] } = useVMs();
  const deleteVM = useDeleteVM();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (deleteTargetId) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [deleteTargetId]);

  const targetVM = vms.find((vm) => vm.id === deleteTargetId);

  return (
    <dialog
      ref={dialogRef}
      onClose={closeDeleteConfirm}
      className="w-full max-w-sm rounded-xl border border-border bg-surface-raised p-6 shadow-xl"
    >
      {deleteTargetId && (
        <>
          <h2 className="mb-2 text-lg font-semibold text-text-primary">Eliminar VM</h2>
          <p className="mb-6 text-sm text-text-secondary">
            ¿Confirmas que quieres eliminar{' '}
            <span className="font-medium text-text-primary">{targetVM?.name ?? deleteTargetId}</span>?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={closeDeleteConfirm}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface"
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteVM.mutate(deleteTargetId)}
              disabled={deleteVM.isPending}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-hover disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {deleteVM.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
