import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { login, ApiError } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { AUTH_QUERY_KEY } from '@/hooks/useAuth';

function validateEmail(value: string): string {
  if (!value) return 'El email es requerido';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Ingresa un email válido';
  return '';
}

function validatePassword(value: string): string {
  if (!value) return 'La contraseña es requerida';
  return '';
}

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [serverError, setServerError] = useState('');

  // Todos los hooks deben declararse antes de cualquier return condicional
  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: ({ user: authUser }) => {
      setUser(authUser);
      queryClient.setQueryData(AUTH_QUERY_KEY, { user: authUser });
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      const msg =
        error instanceof ApiError && error.status === 401
          ? 'Email o contraseña incorrectos'
          : 'Error al iniciar sesión, intenta de nuevo';
      setServerError(msg); // mensaje inline bajo el form (SDD §14.1)
      toast.error(msg);    // toast (SDD §14.1 — ambos son requeridos)
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;
    setServerError('');
    mutation.mutate();
  }

  // Return condicional DESPUÉS de todos los hooks
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface-raised p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-text-primary">VM Dashboard</h1>

        {serverError && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950">
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailError(validateEmail(email))}
              aria-describedby={emailError ? 'email-error' : undefined}
              aria-invalid={!!emailError}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-brand aria-[invalid=true]:border-danger"
            />
            {emailError && (
              <p id="email-error" role="alert" className="mt-1 text-xs text-danger">
                {emailError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-text-secondary">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordError(validatePassword(password))}
              aria-describedby={passwordError ? 'password-error' : undefined}
              aria-invalid={!!passwordError}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-brand aria-[invalid=true]:border-danger"
            />
            {passwordError && (
              <p id="password-error" role="alert" className="mt-1 text-xs text-danger">
                {passwordError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-brand py-2 font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {mutation.isPending ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
