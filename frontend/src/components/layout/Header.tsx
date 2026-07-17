import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Server } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { logout } from '@/api/auth';
import { AUTH_QUERY_KEY } from '@/hooks/useAuth';

export function Header() {
  // Todos los hooks antes de cualquier condicional (lección módulo 1)
  const user           = useAuthStore((s) => s.user);
  const setUser        = useAuthStore((s) => s.setUser);
  const darkMode       = useUiStore((s) => s.darkMode);
  const toggleDarkMode = useUiStore((s) => s.toggleDarkMode);
  const navigate       = useNavigate();
  const queryClient    = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      setUser(null);
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
      navigate('/login', { replace: true });
    },
  });

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface-raised px-6 py-3 border-t-2 border-t-brand">
      <span className="flex items-center gap-2 text-lg font-bold">
        <Server size={18} className="text-brand dark:text-indigo-400" />
        <span className="text-brand dark:text-indigo-400">VM</span>
        <span className="text-text-primary">Dashboard</span>
      </span>

      <div className="flex items-center gap-4">
        {user && (
          <div className="text-sm">
            <span className="text-text-primary font-medium">{user.email}</span>
            <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand dark:bg-indigo-950 dark:text-indigo-400">
              {user.role}
            </span>
          </div>
        )}

        <button
          onClick={toggleDarkMode}
          aria-label="Toggle dark mode"
          className="rounded-lg border border-border p-1.5 text-text-secondary transition-colors hover:bg-surface"
        >
          {darkMode ? '☀️' : '🌙'}
        </button>

        <button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface disabled:opacity-60"
        >
          {logoutMutation.isPending ? 'Saliendo…' : 'Salir'}
        </button>
      </div>
    </header>
  );
}
