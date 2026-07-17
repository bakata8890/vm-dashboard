import { useQuery } from '@tanstack/react-query';
import { getVMs } from '@/api/vms';
import type { VM } from '@/types/vm';

export const VMS_QUERY_KEY = ['vms'] as const;

export function useVMs() {
  return useQuery<VM[]>({
    queryKey: VMS_QUERY_KEY,
    queryFn: getVMs,
    staleTime: 1000 * 30,
  });
}
