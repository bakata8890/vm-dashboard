import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { VMForm } from './VMForm';

vi.mock('@/api/vms', () => ({ createVM: vi.fn(), updateVM: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { createVM } from '@/api/vms';
const createMock = vi.mocked(createVM);

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderForm(mode: 'create' | 'edit' = 'create') {
  return render(
    <VMForm mode={mode} initialValues={null} onClose={vi.fn()} />,
    { wrapper: Wrapper },
  );
}

describe('VMForm — validaciones (SDD §14.2)', () => {
  it('muestra error de nombre requerido al perder foco con campo vacío', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByLabelText('Nombre'));
    await user.tab();
    expect(screen.getByText('Requerido')).toBeInTheDocument();
  });

  it('muestra error cuando el nombre tiene menos de 3 caracteres', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Nombre'), 'ab');
    await user.tab();
    expect(screen.getByText('Mínimo 3 caracteres')).toBeInTheDocument();
  });

  it('muestra error cuando el nombre contiene caracteres inválidos', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Nombre'), 'vm@test!');
    await user.tab();
    expect(screen.getByText('Debe comenzar con letra o número; solo letras, números, espacios, - y _')).toBeInTheDocument();
  });

  it('[REGRESIÓN] muestra error cuando el nombre empieza con - o _ (divergencia frontend/backend)', async () => {
    // Backend: ^[a-zA-Z0-9][a-zA-Z0-9 _-]*$  — primer char obligatoriamente alfanumérico
    // Bug anterior: frontend usaba ^[a-zA-Z0-9 \-_]+$ — aceptaba "-prod" como válido
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Nombre'), '-prod-server');
    await user.tab();
    expect(screen.getByText('Debe comenzar con letra o número; solo letras, números, espacios, - y _')).toBeInTheDocument();
  });

  it('muestra error cuando cores supera 64', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Cores'), '65');
    await user.tab();
    expect(screen.getByText('Máximo 64')).toBeInTheDocument();
  });

  it('muestra error cuando RAM supera 512 GB', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('RAM (GB)'), '600');
    await user.tab();
    expect(screen.getByText('Máximo 512 GB')).toBeInTheDocument();
  });

  it('muestra error cuando el disco supera 4096 GB', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Disco (GB)'), '5000');
    await user.tab();
    expect(screen.getByText('Máximo 4096 GB')).toBeInTheDocument();
  });

  it('muestra error cuando no se selecciona SO al perder foco', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByLabelText('Sistema operativo'));
    await user.tab();
    expect(screen.getByText('Selecciona un sistema operativo')).toBeInTheDocument();
  });

  it('no llama a createVM si hay errores de validación al hacer submit', async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue({} as never);
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Crear VM' }));
    expect(createMock).not.toHaveBeenCalled();
  });
});
