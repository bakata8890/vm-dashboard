import { create } from 'zustand';

const HIGHLIGHT_MS = 2_000;

interface UiState {
  // Dark mode — aplicación de tokens completa en módulo 8
  darkMode: boolean;
  toggleDarkMode: () => void;

  // VM form modal (create / edit)
  vmFormMode: 'create' | 'edit' | null;
  selectedVMId: string | null;
  openVMForm: (mode: 'create' | 'edit', vmId: string | null) => void;
  closeVMForm: () => void;

  // Delete confirmation modal
  deleteTargetId: string | null;
  openDeleteConfirm: (vmId: string) => void;
  closeDeleteConfirm: () => void;

  // WS: highlight visual al recibir vm_updated (§14.4)
  recentlyUpdatedVMs: Set<string>;
  markVMUpdated: (id: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  // localStorage guarda solo la preferencia de tema — nunca auth, nunca tokens (ver módulos 1/3)
  darkMode: localStorage.getItem('darkMode') === 'true',
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode;
    localStorage.setItem('darkMode', String(next));
    return { darkMode: next };
  }),

  vmFormMode: null,
  selectedVMId: null,
  openVMForm: (mode, vmId) => set({ vmFormMode: mode, selectedVMId: vmId }),
  closeVMForm: () => set({ vmFormMode: null, selectedVMId: null }),

  deleteTargetId: null,
  openDeleteConfirm: (vmId) => set({ deleteTargetId: vmId }),
  closeDeleteConfirm: () => set({ deleteTargetId: null }),

  recentlyUpdatedVMs: new Set<string>(),
  markVMUpdated: (id) => {
    set((s) => ({ recentlyUpdatedVMs: new Set(s.recentlyUpdatedVMs).add(id) }));
    setTimeout(
      () => set((s) => {
        const next = new Set(s.recentlyUpdatedVMs);
        next.delete(id);
        return { recentlyUpdatedVMs: next };
      }),
      HIGHLIGHT_MS,
    );
  },
}));
