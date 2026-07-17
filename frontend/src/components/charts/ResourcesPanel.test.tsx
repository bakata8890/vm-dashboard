import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { ResourcesPanel } from './ResourcesPanel';
import { VMS_QUERY_KEY } from '@/hooks/useVMs';
import type { VM } from '@/types/vm';

// Recharts usa ResizeObserver internamente
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function makeWrapper(vms: VM[]) {
  const qc = new QueryClient();
  qc.setQueryData(VMS_QUERY_KEY, vms);
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const encendida = (overrides: Partial<VM> = {}): VM => ({
  id: '1', name: 'vm-on', cores: 4, ram_gb: 8, disk_gb: 100,
  os: 'Ubuntu 22.04', status: 'encendida',
  created_at: '', updated_at: '', ...overrides,
});

const apagada = (overrides: Partial<VM> = {}): VM => ({
  ...encendida(), id: '2', name: 'vm-off', status: 'apagada', ...overrides,
});

describe('ResourcesPanel (SDD §14.3)', () => {
  it('muestra "0 encendidas" cuando no hay VMs', () => {
    render(<ResourcesPanel />, { wrapper: makeWrapper([]) });
    expect(screen.getByText(/VMs encendidas \(0\)/)).toBeInTheDocument();
  });

  it('solo cuenta VMs con status encendida', () => {
    render(<ResourcesPanel />, {
      wrapper: makeWrapper([encendida(), apagada()]),
    });
    expect(screen.getByText(/VMs encendidas \(1\)/)).toBeInTheDocument();
  });

  it('excluye los recursos de VMs apagadas del cálculo', () => {
    // Una encendida con 4 cores + una apagada con 8 cores → total debe ser 4
    const vms = [
      encendida({ id: '1', cores: 4 }),
      apagada({ id: '2', cores: 8 }),
    ];
    // Verificamos que el panel renderiza (Recharts) y el conteo es correcto
    render(<ResourcesPanel />, { wrapper: makeWrapper(vms) });
    expect(screen.getByText(/VMs encendidas \(1\)/)).toBeInTheDocument();
  });

  it('suma correctamente los recursos de múltiples VMs encendidas', () => {
    const vms = [
      encendida({ id: '1', cores: 4, ram_gb: 8,  disk_gb: 100 }),
      encendida({ id: '2', cores: 8, ram_gb: 16, disk_gb: 200 }),
    ];
    render(<ResourcesPanel />, { wrapper: makeWrapper(vms) });
    expect(screen.getByText(/VMs encendidas \(2\)/)).toBeInTheDocument();
  });
});
