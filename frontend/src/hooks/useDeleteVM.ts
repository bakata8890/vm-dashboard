import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteVM } from '@/api/vms';
import { useUiStore } from '@/store/uiStore';
import { VMS_QUERY_KEY } from '@/hooks/useVMs';
import type { VM } from '@/types/vm';

export function useDeleteVM() {
  const queryClient = useQueryClient();
  const closeDeleteConfirm = useUiStore((s) => s.closeDeleteConfirm);

  return useMutation({
    mutationFn: (id: string) => deleteVM(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: VMS_QUERY_KEY });
      const snapshot = queryClient.getQueryData<VM[]>(VMS_QUERY_KEY);
      queryClient.setQueryData<VM[]>(VMS_QUERY_KEY, (old = []) =>
        old.filter((vm) => vm.id !== id),
      );
      return { snapshot };
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(VMS_QUERY_KEY, context?.snapshot);
      toast.error('No se pudo eliminar la VM');
    },
    onSuccess: () => {
      closeDeleteConfirm();
      toast.success('VM eliminada');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: VMS_QUERY_KEY });
    },
  });
}
