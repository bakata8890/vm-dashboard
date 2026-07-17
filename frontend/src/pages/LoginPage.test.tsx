import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';
import { useAuthStore } from '@/store/authStore';

// Mocks de módulos externos
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { login } from '@/api/auth';
import { toast } from 'sonner';

const loginMock = vi.mocked(login);
const toastErrorMock = vi.mocked(toast.error);

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={['/login']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
    loginMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('renderiza sin crashear y muestra el formulario', () => {
    renderLoginPage();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('muestra errores inline al hacer submit con campos vacíos', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(screen.getByText('El email es requerido')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es requerida')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('dispara login() con email y password correctos al hacer submit', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ user: { id: '1', email: 'admin@test.com', role: 'admin' } });
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('admin@test.com', 'secret'));
  });

  it('redirige a /dashboard tras login exitoso', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ user: { id: '1', email: 'admin@test.com', role: 'admin' } });
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(screen.getByTestId('dashboard')).toBeInTheDocument());
  });

  it('muestra mensaje inline + toast.error en error de credenciales (401)', async () => {
    const { ApiError } = await import('@/api/auth');
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new ApiError(401, 'Unauthorized'));
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'cliente@test.com');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
      expect(toastErrorMock).toHaveBeenCalledWith('Email o contraseña incorrectos');
    });
  });

  it('no llama a login() si el email tiene formato inválido', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'no-es-un-email');
    await user.type(screen.getByLabelText('Contraseña'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(loginMock).not.toHaveBeenCalled();
    expect(screen.getByText('Ingresa un email válido')).toBeInTheDocument();
  });

  describe('[REGRESIÓN]', () => {
    it('Bug 1 — Rules of Hooks: no lanza cuando user pasa de null a non-null en re-render', async () => {
      // El bug: useMutation estaba DESPUÉS de `if (user) return`.
      // Al pasar user de null → admin, React detectaba menos hooks que en el render anterior
      // y lanzaba "Rendered fewer hooks than during the previous render".
      // Este test fuerza exactamente esa transición de estado.
      renderLoginPage();

      // Verificamos que el formulario está visible (user = null, primer render)
      expect(screen.getByLabelText('Email')).toBeInTheDocument();

      // Forzamos la transición user null → admin directamente en el store,
      // sin pasar por la mutación, para aislar la condición del bug.
      act(() => {
        useAuthStore.setState({ user: { id: '1', email: 'admin@test.com', role: 'admin' } });
      });

      // Si el hook estaba en posición condicional, React lanza aquí.
      // Con el fix, el componente navega a /dashboard sin error.
      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });

    it('Bug 2 — Selector Zustand inestable: múltiples actualizaciones del store no producen loop infinito', () => {
      // El bug: useAuthStore((s) => ({ user: s.user, setUser: s.setUser })) creaba
      // un objeto nuevo en cada llamada. useSyncExternalStore detectaba el cambio
      // de referencia como una actualización y disparaba otro render → loop infinito
      // → "Maximum update depth exceeded".
      // Este test fuerza actualizaciones repetidas del store para detectar el loop.
      renderLoginPage();

      expect(() => {
        act(() => { useAuthStore.setState({ user: null }); });
        act(() => { useAuthStore.setState({ user: null }); });
        act(() => { useAuthStore.setState({ user: null }); });
      }).not.toThrow();

      // Si llegamos aquí sin timeout ni "Maximum update depth exceeded", el selector es estable.
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });
  });
});
