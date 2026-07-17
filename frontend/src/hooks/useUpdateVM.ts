import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { updateVM } from '@/api/vms';
import { useUiStore } from '@/store/uiStore';
import { VMS_QUERY_KEY } from '@/hooks/useVMs';
import type { VM, VMFormData } from '@/types/vm';

export function useUpdateVM() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const closeVMForm = useUiStore((s) => s.closeVMForm);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VMFormData> }) =>
      updateVM(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: VMS_QUERY_KEY });
      const snapshot = queryClient.getQueryData<VM[]>(VMS_QUERY_KEY);
      queryClient.setQueryData<VM[]>(VMS_QUERY_KEY, (old = []) =>
        old.map((vm) => (vm.id === id ? { ...vm, ...data } : vm)),
      );
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(VMS_QUERY_KEY, context?.snapshot);
      toast.error('No se pudo actualizar la VM');
    },
    onSuccess: () => {
      toast.success('VM actualizada');
      closeVMForm();
      navigate('/dashboard', { replace: true });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: VMS_QUERY_KEY });
    },
  });
}
