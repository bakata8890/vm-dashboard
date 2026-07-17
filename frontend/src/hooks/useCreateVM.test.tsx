import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { useCreateVM } from './useCreateVM';
import { VMS_QUERY_KEY } from './useVMs';
import type { VM, VMFormData } from '@/types/vm';

vi.mock('@/api/vms', () => ({ createVM: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { createVM } from '@/api/vms';
import { toast } from 'sonner';
const createMock = vi.mocked(createVM);
const toastErrorMock = vi.mocked(toast.error);

const formData: VMFormData = {
  name: 'mi-vm', cores: 2, ram_gb: 4, disk_gb: 50,
  os: 'Ubuntu 22.04', status: 'apagada',
};

const serverVM: VM = {
  ...formData, id: 'server-id',
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

describe('useCreateVM', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(VMS_QUERY_KEY, []);
    createMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('añade una VM temporal al cache antes de que responda el servidor', async () => {
    let resolveCreate!: (v: VM) => void;
    createMock.mockImplementation(
      () => new Promise<VM>((res) => { resolveCreate = res; }),
    );
    const { result } = renderHook(() => useCreateVM(), { wrapper: makeWrapper(queryClient) });

    act(() => { result.current.mutate(formData); });

    await waitFor(() => {
      const data = queryClient.getQueryData<VM[]>(VMS_QUERY_KEY);
      expect(data).toHaveLength(1);
      expect(data?.[0].id).toMatch(/^temp-/);
      expect(data?.[0].name).toBe('mi-vm');
    });

    resolveCreate(serverVM); // limpieza
  });

  it('hace rollback de la VM temporal ante error del servidor', async () => {
    createMock.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useCreateVM(), { wrapper: makeWrapper(queryClient) });

    act(() => { result.current.mutate(formData); });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const afterRollback = queryClient.getQueryData<VM[]>(VMS_QUERY_KEY);
    expect(afterRollback).toHaveLength(0);
  });

  it('muestra toast.error en el rollback', async () => {
    createMock.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useCreateVM(), { wrapper: makeWrapper(queryClient) });

    act(() => { result.current.mutate(formData); });

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('No se pudo crear la VM'));
  });
});
