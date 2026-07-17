import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { VM } from '@/types/vm';
import { VMS_QUERY_KEY } from '@/hooks/useVMs';
import { useUiStore } from '@/store/uiStore';

const MAX_BACKOFF_MS = 30_000;

type WSEventType = 'vm_created' | 'vm_updated' | 'vm_deleted';

interface WSEvent {
  type: WSEventType;
  data: VM | { id: string };
}

export function useVMWebSocket() {
  const queryClient = useQueryClient();
  const markVMUpdated = useUiStore((s) => s.markVMUpdated);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstConnect = useRef(true);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0;
      if (!isFirstConnect.current) {
        // Reconexión: pueden haberse perdido eventos durante el corte
        void queryClient.invalidateQueries({ queryKey: VMS_QUERY_KEY });
      }
      isFirstConnect.current = false;
    };

    ws.onmessage = (event: MessageEvent) => {
      let parsed: WSEvent;
      try {
        parsed = JSON.parse(event.data as string) as WSEvent;
      } catch {
        return;
      }

      if (parsed.type === 'vm_created') {
        // invalidateQueries evita el duplicado temp-* + UUID real que produciría setQueryData
        void queryClient.invalidateQueries({ queryKey: VMS_QUERY_KEY });
        return;
      }

      if (parsed.type === 'vm_updated') {
        const vm = parsed.data as VM;
        queryClient.setQueryData<VM[]>(VMS_QUERY_KEY, (old) => {
          if (!old) return old;
          return old.map((v) => {
            if (v.id !== vm.id) return v;
            // No aplicar evento atrasado sobre estado más reciente (ISO 8601 compara lexicográficamente)
            if (vm.updated_at <= v.updated_at) return v;
            return vm;
          });
        });
        markVMUpdated(vm.id);
        return;
      }

      if (parsed.type === 'vm_deleted') {
        const { id } = parsed.data as { id: string };
        queryClient.setQueryData<VM[]>(VMS_QUERY_KEY, (old) => {
          if (!old) return old;
          // Idempotente: si ya fue removida por optimistic delete, filter es no-op
          return old.filter((v) => v.id !== id);
        });
      }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      const delay = Math.min(1_000 * 2 ** retryCount.current, MAX_BACKOFF_MS);
      retryCount.current += 1;
      retryTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close(); // dispara onclose → reintento
  }, [queryClient, markVMUpdated]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
