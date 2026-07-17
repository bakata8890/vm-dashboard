import type { VM, VMFormData } from '@/types/vm';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getVMs(): Promise<VM[]> {
  return request('/api/vms');
}

export function createVM(data: VMFormData): Promise<VM> {
  return request('/api/vms', { method: 'POST', body: JSON.stringify(data) });
}

export function updateVM(id: string, data: Partial<VMFormData>): Promise<VM> {
  return request(`/api/vms/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteVM(id: string): Promise<void> {
  return request(`/api/vms/${id}`, { method: 'DELETE' });
}
