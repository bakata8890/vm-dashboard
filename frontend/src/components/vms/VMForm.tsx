import { useState, type FormEvent } from 'react';
import { useCreateVM } from '@/hooks/useCreateVM';
import { useUpdateVM } from '@/hooks/useUpdateVM';
import { OS_OPTIONS } from '@/types/vm';
import type { VM, VMFormData, VMStatus } from '@/types/vm';

// ── Validaciones (SDD §14.2) ──────────────────────────────────────────────────

function validateName(v: string): string {
  if (!v.trim()) return 'Requerido';
  if (v.length < 3) return 'Mínimo 3 caracteres';
  if (v.length > 50) return 'Máximo 50 caracteres';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 \-_]*$/.test(v)) return 'Debe comenzar con letra o número; solo letras, números, espacios, - y _';
  return '';
}

function validateInt(v: string, min: number, max: number, unit = ''): string {
  if (!v) return 'Requerido';
  const n = Number(v);
  if (!Number.isInteger(n) || String(n) !== v.trim()) return 'Debe ser entero';
  if (n < min) return `Mínimo ${min}${unit}`;
  if (n > max) return `Máximo ${max}${unit}`;
  return '';
}

function validateOS(v: string): string {
  return v ? '' : 'Selecciona un sistema operativo';
}

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  mode: 'create' | 'edit';
  initialValues: VM | null;
  onClose: () => void;
}

type FieldErrors = {
  name: string; cores: string; ram_gb: string; disk_gb: string; os: string;
};

const EMPTY_ERRORS: FieldErrors = { name: '', cores: '', ram_gb: '', disk_gb: '', os: '' };

export function VMForm({ mode, initialValues, onClose }: Props) {
  // Todos los hooks antes de cualquier condicional (lección módulo 1)
  const createVM = useCreateVM();
  const updateVM = useUpdateVM();

  const [name, setName]       = useState(initialValues?.name ?? '');
  const [cores, setCores]     = useState(String(initialValues?.cores ?? ''));
  const [ram, setRam]         = useState(String(initialValues?.ram_gb ?? ''));
  const [disk, setDisk]       = useState(String(initialValues?.disk_gb ?? ''));
  const [os, setOs]           = useState(initialValues?.os ?? '');
  const [status, setStatus]   = useState<VMStatus>(initialValues?.status ?? 'apagada');
  const [errors, setErrors]   = useState<FieldErrors>(EMPTY_ERRORS);

  const isPending = createVM.isPending || updateVM.isPending;

  function validateAll(): FieldErrors {
    return {
      name:   validateName(name),
      cores:  validateInt(cores, 1, 64),
      ram_gb: validateInt(ram, 1, 512, ' GB'),
      disk_gb: validateInt(disk, 1, 4096, ' GB'),
      os:     validateOS(os),
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateAll();
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    const data: VMFormData = {
      name: name.trim(),
      cores: Number(cores),
      ram_gb: Number(ram),
      disk_gb: Number(disk),
      os,
      status,
    };

    if (mode === 'create') {
      createVM.mutate(data);
    } else if (initialValues) {
      updateVM.mutate({ id: initialValues.id, data });
    }
  }

  const label = 'mb-1 block text-sm font-medium text-text-secondary';
  const input = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-brand aria-[invalid=true]:border-danger';
  const errorMsg = 'mt-1 text-xs text-danger';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="vm-name" className={label}>Nombre</label>
        <input
          id="vm-name" type="text" value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setErrors((p) => ({ ...p, name: validateName(name) }))}
          aria-invalid={!!errors.name} aria-describedby={errors.name ? 'err-name' : undefined}
          className={input}
        />
        {errors.name && <p id="err-name" role="alert" className={errorMsg}>{errors.name}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="vm-cores" className={label}>Cores</label>
          <input
            id="vm-cores" type="number" min={1} max={64} value={cores}
            onChange={(e) => setCores(e.target.value)}
            onBlur={() => setErrors((p) => ({ ...p, cores: validateInt(cores, 1, 64) }))}
            aria-invalid={!!errors.cores} aria-describedby={errors.cores ? 'err-cores' : undefined}
            className={input}
          />
          {errors.cores && <p id="err-cores" role="alert" className={errorMsg}>{errors.cores}</p>}
        </div>
        <div>
          <label htmlFor="vm-ram" className={label}>RAM (GB)</label>
          <input
            id="vm-ram" type="number" min={1} max={512} value={ram}
            onChange={(e) => setRam(e.target.value)}
            onBlur={() => setErrors((p) => ({ ...p, ram_gb: validateInt(ram, 1, 512, ' GB') }))}
            aria-invalid={!!errors.ram_gb} aria-describedby={errors.ram_gb ? 'err-ram' : undefined}
            className={input}
          />
          {errors.ram_gb && <p id="err-ram" role="alert" className={errorMsg}>{errors.ram_gb}</p>}
        </div>
        <div>
          <label htmlFor="vm-disk" className={label}>Disco (GB)</label>
          <input
            id="vm-disk" type="number" min={1} max={4096} value={disk}
            onChange={(e) => setDisk(e.target.value)}
            onBlur={() => setErrors((p) => ({ ...p, disk_gb: validateInt(disk, 1, 4096, ' GB') }))}
            aria-invalid={!!errors.disk_gb} aria-describedby={errors.disk_gb ? 'err-disk' : undefined}
            className={input}
          />
          {errors.disk_gb && <p id="err-disk" role="alert" className={errorMsg}>{errors.disk_gb}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="vm-os" className={label}>Sistema operativo</label>
        <select
          id="vm-os" value={os}
          onChange={(e) => setOs(e.target.value)}
          onBlur={() => setErrors((p) => ({ ...p, os: validateOS(os) }))}
          aria-invalid={!!errors.os} aria-describedby={errors.os ? 'err-os' : undefined}
          className={input}
        >
          <option value="">Seleccionar…</option>
          {OS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {errors.os && <p id="err-os" role="alert" className={errorMsg}>{errors.os}</p>}
      </div>

      <div>
        <label htmlFor="vm-status" className={label}>Estado</label>
        <select
          id="vm-status" value={status}
          onChange={(e) => setStatus(e.target.value as VMStatus)}
          className={input}
        >
          <option value="apagada">Apagada</option>
          <option value="encendida">Encendida</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button" onClick={onClose}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface"
        >
          Cancelar
        </button>
        <button
          type="submit" disabled={isPending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {isPending ? 'Guardando…' : mode === 'create' ? 'Crear VM' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
