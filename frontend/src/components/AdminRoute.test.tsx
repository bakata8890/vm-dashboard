import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { AdminRoute } from './AdminRoute';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';

function renderWithAuth(user: AuthUser | null, initialPath = '/vms/nueva') {
  useAuthStore.setState({ user });

  return render(
    <MemoryRouter initialEntries={[initialPath]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/dashboard" element={<div data-testid="dashboard" />} />
        <Route element={<AdminRoute />}>
          <Route path="/vms/nueva" element={<div data-testid="protected-content">Contenido admin</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('no renderiza los hijos cuando el rol es "cliente"', () => {
    renderWithAuth({ id: '1', email: 'cliente@test.com', role: 'cliente' });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirige a /dashboard cuando el rol es "cliente"', () => {
    renderWithAuth({ id: '1', email: 'cliente@test.com', role: 'cliente' });

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('renderiza los hijos cuando el rol es "admin"', () => {
    renderWithAuth({ id: '2', email: 'admin@test.com', role: 'admin' });

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('no renderiza los hijos cuando user es null', () => {
    renderWithAuth(null);

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
