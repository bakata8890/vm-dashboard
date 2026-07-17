import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { useVMWebSocket } from './useVMWebSocket';
import { VMS_QUERY_KEY } from './useVMs';
import type { VM } from '@/types/vm';

// --- WebSocket mock ---

interface MockWS {
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
}

let mockWS: MockWS;

vi.stubGlobal('WebSocket', class {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor() { mockWS = this as unknown as MockWS; }
});

// --- helpers ---

const vmA: VM = {
  id: 'vm-a', name: 'Alpha', cores: 2, ram_gb: 4, disk_gb: 50,
  os: 'Ubuntu 22.04', status: 'encendida',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T10:00:00Z',
};

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useVMWebSocket', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData<VM[]>(VMS_QUERY_KEY, [vmA]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('vm_updated con timestamp más nuevo aplica el cambio al cache', () => {
    renderHook(() => useVMWebSocket(), { wrapper: makeWrapper(queryClient) });

    const newer: VM = { ...vmA, name: 'Alpha-v2', updated_at: '2026-01-01T11:00:00Z' };
    act(() => {
      mockWS.onmessage?.({ data: JSON.stringify({ type: 'vm_updated', data: newer }) });
    });

    const data = queryClient.getQueryData<VM[]>(VMS_QUERY_KEY);
    expect(data?.[0].name).toBe('Alpha-v2');
  });

  it('vm_updated con timestamp igual o anterior no sobreescribe el cache', () => {
    renderHook(() => useVMWebSocket(), { wrapper: makeWrapper(queryClient) });

    const stale: VM = { ...vmA, name: 'Stale', updated_at: '2026-01-01T09:00:00Z' };
    act(() => {
      mockWS.onmessage?.({ data: JSON.stringify({ type: 'vm_updated', data: stale }) });
    });

    const data = queryClient.getQueryData<VM[]>(VMS_QUERY_KEY);
    expect(data?.[0].name).toBe('Alpha'); // sin cambio
  });

  it('vm_deleted elimina la VM del cache (idempotente)', () => {
    renderHook(() => useVMWebSocket(), { wrapper: makeWrapper(queryClient) });

    act(() => {
      mockWS.onmessage?.({ data: JSON.stringify({ type: 'vm_deleted', data: { id: 'vm-a' } }) });
    });

    const data = queryClient.getQueryData<VM[]>(VMS_QUERY_KEY);
    expect(data).toHaveLength(0);

    // Segunda vez — no rompe nada
    act(() => {
      mockWS.onmessage?.({ data: JSON.stringify({ type: 'vm_deleted', data: { id: 'vm-a' } }) });
    });
    expect(queryClient.getQueryData<VM[]>(VMS_QUERY_KEY)).toHaveLength(0);
  });

  it('vm_created llama invalidateQueries (no setQueryData)', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useVMWebSocket(), { wrapper: makeWrapper(queryClient) });

    act(() => {
      mockWS.onmessage?.({ data: JSON.stringify({ type: 'vm_created', data: { id: 'new-vm' } }) });
    });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: VMS_QUERY_KEY }));
  });

  it('NO llama invalidateQueries en la primera conexión (onopen inicial)', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useVMWebSocket(), { wrapper: makeWrapper(queryClient) });

    act(() => { mockWS.onopen?.(); });

    expect(spy).not.toHaveBeenCalled();
  });

  it('en reconexión (segundo onopen) llama invalidateQueries para resincronizar', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useVMWebSocket(), { wrapper: makeWrapper(queryClient) });

    // Primera conexión — no invalida
    act(() => { mockWS.onopen?.(); });
    expect(spy).not.toHaveBeenCalled();

    // Cierre → reconexión simulada llamando onopen de nuevo sobre el mismo mock
    act(() => { mockWS.onclose?.(); });
    // El timer de retry no se dispara en tests — simulamos la reconexión llamando onopen
    act(() => { mockWS.onopen?.(); });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: VMS_QUERY_KEY }));
  });
});
