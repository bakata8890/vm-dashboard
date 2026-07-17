import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMe, ApiError } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getMe,
    retry: (failureCount, error) => {
      // 401 = sin sesión, no reintentar
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });

  useEffect(() => {
    if (query.data) {
      setUser(query.data.user);
    }
    if (query.error instanceof ApiError && query.error.status === 401) {
      setUser(null);
    }
  }, [query.data, query.error, setUser]);

  return {
    user,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
