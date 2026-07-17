import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { useDeleteVM } from './useDeleteVM';
import { VMS_QUERY_KEY } from './useVMs';
import type { VM } from '@/types/vm';

vi.mock('@/api/vms', () => ({ deleteVM: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { deleteVM } from '@/api/vms';
import { toast } from 'sonner';
const deleteMock = vi.mocked(deleteVM);
const toastErrorMock = vi.mocked(toast.error);

const mockVM: VM = {
  id: 'vm-1', name: 'test', cores: 2, ram_gb: 4, disk_gb: 50,
  os: 'Ubuntu 22.04', status: 'apagada',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useDeleteVM', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(VMS_QUERY_KEY, [mockVM]);
    deleteMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('elimina la VM del cache de forma optimista antes de que responda el servidor', async () => {
    // Promise que nunca resuelve: mantiene el servidor "pendiente"
    // para poder verificar el estado optimista antes de onSuccess/onSettled
    let resolveDelete!: () => void;
    deleteMock.mockImplementation(
      () => new Promise<void>((res) => { resolveDelete = res; }),
    );
    const { result } = renderHook(() => useDeleteVM(), { wrapper: makeWrapper(queryClient) });

    act(() => { result.current.mutate('vm-1'); });

    // onMutate es async (await cancelQueries), esperamos que el update optimista aparezca
    await waitFor(() => {
      const data = queryClient.getQueryData<VM[]>(VMS_QUERY_KEY);
      expect(data?.find((v) => v.id === 'vm-1')).toBeUndefined();
    });

    resolveDelete(); // limpieza
  });

  it('hace rollback de la VM eliminada ante error del servidor', async () => {
    deleteMock.mockRejectedValue(new Error('500 Internal Server Error'));
    const { result } = renderHook(() => useDeleteVM(), { wrapper: makeWrapper(queryClient) });

    act(() => { result.current.mutate('vm-1'); });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const afterRollback = queryClient.getQueryData<VM[]>(VMS_QUERY_KEY);
    expect(afterRollback?.find((v) => v.id === 'vm-1')).toEqual(mockVM);
  });

  it('muestra toast.error en el rollback', async () => {
    deleteMock.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useDeleteVM(), { wrapper: makeWrapper(queryClient) });

    act(() => { result.current.mutate('vm-1'); });

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('No se pudo eliminar la VM'));
  });
});
