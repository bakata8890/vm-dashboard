import { Pencil, Trash2, Power, PowerOff, Cpu, MemoryStick, HardDrive, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import type { VM } from '@/types/vm';

interface Props {
  vm: VM;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-secondary">{icon}</span>
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="ml-auto font-mono text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

export function VMCard({ vm }: Props) {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const openDeleteConfirm = useUiStore((s) => s.openDeleteConfirm);
  const isUpdated = useUiStore((s) => s.recentlyUpdatedVMs.has(vm.id));

  const isOn = vm.status === 'encendida';

  return (
    <div className={`rounded-xl border bg-surface-raised p-4 shadow-sm space-y-3 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-brand hover:shadow-brand/10${isUpdated ? ' vm-updated border-brand/70' : ' border-border'}`}>

      {/* Header: nombre + acciones */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-text-primary truncate leading-tight">{vm.name}</h3>
        {role === 'admin' && (
          <div className="flex shrink-0 gap-1">
            <button
              data-testid="edit-btn"
              onClick={() => navigate(`/vms/${vm.id}/editar`)}
              aria-label="Editar VM"
              className="flex items-center justify-center rounded-lg border border-border p-1.5 text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
            >
              <Pencil size={13} />
            </button>
            <button
              data-testid="delete-btn"
              onClick={() => openDeleteConfirm(vm.id)}
              aria-label="Eliminar VM"
              className="flex items-center justify-center rounded-lg border border-danger p-1.5 text-danger transition-colors hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Specs con iconos y números mono */}
      <dl className="space-y-1.5 border-t border-border pt-3">
        <Stat icon={<Cpu size={13} />}        label="Cores"  value={String(vm.cores)} />
        <Stat icon={<MemoryStick size={13} />} label="RAM"    value={`${vm.ram_gb} GB`} />
        <Stat icon={<HardDrive size={13} />}   label="Disco"  value={`${vm.disk_gb} GB`} />
        <Stat icon={<Monitor size={13} />}     label="OS"     value={vm.os} />
      </dl>

      {/* Badge de estado con dot */}
      <div className="pt-1">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isOn
              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isOn ? 'bg-green-500 dark:bg-green-400' : 'bg-gray-400 dark:bg-gray-500'
            }`}
            aria-hidden="true"
          />
          {isOn ? <Power size={10} /> : <PowerOff size={10} />}
          {vm.status}
        </span>
      </div>
    </div>
  );
}
