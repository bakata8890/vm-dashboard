import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { VMCard } from './VMCard';
import { useAuthStore } from '@/store/authStore';
import type { VM } from '@/types/vm';

function Wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter>;
}

const vm: VM = {
  id: 'vm-1', name: 'test-vm', cores: 4, ram_gb: 8, disk_gb: 100,
  os: 'Ubuntu 22.04', status: 'encendida',
  created_at: '', updated_at: '',
};

describe('VMCard — control de acceso por rol (SDD §14.1 + §15)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('admin ve los botones editar y eliminar en el DOM', () => {
    useAuthStore.setState({ user: { id: '1', email: 'admin@test.com', role: 'admin' } });
    render(<VMCard vm={vm} />, { wrapper: Wrapper });

    expect(screen.getByTestId('edit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('delete-btn')).toBeInTheDocument();
  });

  it('cliente NO tiene los botones editar ni eliminar en el DOM', () => {
    useAuthStore.setState({ user: { id: '2', email: 'cliente@test.com', role: 'cliente' } });
    render(<VMCard vm={vm} />, { wrapper: Wrapper });

    expect(screen.queryByTestId('edit-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-btn')).not.toBeInTheDocument();
  });

  it('muestra el badge correcto para VM encendida', () => {
    useAuthStore.setState({ user: { id: '1', email: 'a@test.com', role: 'cliente' } });
    render(<VMCard vm={vm} />, { wrapper: Wrapper });
    expect(screen.getByText('encendida')).toBeInTheDocument();
  });

  it('muestra el badge correcto para VM apagada', () => {
    useAuthStore.setState({ user: { id: '1', email: 'a@test.com', role: 'cliente' } });
    render(<VMCard vm={{ ...vm, status: 'apagada' }} />, { wrapper: Wrapper });
    expect(screen.getByText('apagada')).toBeInTheDocument();
  });
});
