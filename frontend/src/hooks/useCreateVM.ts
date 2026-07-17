import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createVM } from '@/api/vms';
import { useUiStore } from '@/store/uiStore';
import { VMS_QUERY_KEY } from '@/hooks/useVMs';
import type { VM, VMFormData } from '@/types/vm';

export function useCreateVM() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const closeVMForm = useUiStore((s) => s.closeVMForm);

  return useMutation({
    mutationFn: (data: VMFormData) => createVM(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: VMS_QUERY_KEY });
      const snapshot = queryClient.getQueryData<VM[]>(VMS_QUERY_KEY);
      const tempVM: VM = {
        ...data,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData<VM[]>(VMS_QUERY_KEY, (old = []) => [...old, tempVM]);
      return { snapshot };
    },
    onError: (_err, _data, context) => {
      queryClient.setQueryData(VMS_QUERY_KEY, context?.snapshot);
      toast.error('No se pudo crear la VM');
    },
    onSuccess: () => {
      toast.success('VM creada');
      closeVMForm();
      navigate('/dashboard', { replace: true });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: VMS_QUERY_KEY });
    },
  });
}
