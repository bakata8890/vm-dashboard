import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useVMs } from '@/hooks/useVMs';

// ─── Componente: barra horizontal compacta (≤3 VMs) ────────────────────────
interface CompactMetricProps {
  data: Array<{ name: string; value: number }>;
  label: string;
  unit: string;
  color: string;
  total: number;
}

function CompactMetric({ data, label, unit, color, total }: CompactMetricProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">{label}</span>
        <span className="font-mono text-lg font-bold text-text-primary">
          {total}
          <span className="ml-0.5 text-xs font-normal text-text-secondary"> {unit}</span>
        </span>
      </div>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-right text-xs text-text-secondary">{d.name}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{ width: `${Math.max((d.value / max) * 100, 4)}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-xs font-medium text-text-primary">
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componente: BarChart completo (>3 VMs) ─────────────────────────────────
interface MiniChartProps {
  data: Array<{ name: string; value: number }>;
  label: string;
  unit: string;
  color: string;
  total: number;
}

function MiniChart({ data, label, unit, color, total }: MiniChartProps) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">{label}</span>
        <span className="font-mono text-lg font-bold text-text-primary">
          {total}
          <span className="ml-0.5 text-xs font-normal text-text-secondary"> {unit}</span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
            width={28}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-primary)',
              fontSize: '12px',
            }}
            formatter={(val) => [`${val ?? 0} ${unit}`, label]}
            cursor={{ fill: 'var(--color-border)', opacity: 0.5 }}
          />
          <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Panel principal ─────────────────────────────────────────────────────────
export function ResourcesPanel() {
  const { data: vms = [] } = useVMs();
  const encendidas = vms.filter((vm) => vm.status === 'encendida');
  const apagadas   = vms.filter((vm) => vm.status === 'apagada');

  const vmData = encendidas.map((vm) => ({
    name:  vm.name.length > 12 ? vm.name.slice(0, 10) + '…' : vm.name,
    cores: vm.cores,
    ram:   vm.ram_gb,
    disk:  vm.disk_gb,
  }));

  const totalCores = encendidas.reduce((s, vm) => s + vm.cores,   0);
  const totalRam   = encendidas.reduce((s, vm) => s + vm.ram_gb,  0);
  const totalDisk  = encendidas.reduce((s, vm) => s + vm.disk_gb, 0);

  // ≤3 VMs encendidas → barras horizontales compactas; >3 → BarChart con ejes
  const useCompact = encendidas.length <= 3;

  const MetricComponent = useCompact ? CompactMetric : MiniChart;

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-border bg-surface-raised">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Recursos en uso
        </h2>
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand dark:bg-indigo-950 dark:text-indigo-400">
          VMs encendidas ({encendidas.length})
        </span>
      </div>

      {/* Stats row: Total / Encendidas / Apagadas */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-b border-border">
        <div className="flex flex-col items-center py-2.5">
          <span className="font-mono text-2xl font-bold leading-none text-text-primary">{vms.length}</span>
          <span className="mt-0.5 text-xs text-text-secondary">Total VMs</span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span className="font-mono text-2xl font-bold leading-none text-green-500 dark:text-green-400">
            {encendidas.length}
          </span>
          <span className="mt-0.5 text-xs text-text-secondary">Encendidas</span>
        </div>
        <div className="flex flex-col items-center py-2.5">
          <span className="font-mono text-2xl font-bold leading-none text-text-secondary">
            {apagadas.length}
          </span>
          <span className="mt-0.5 text-xs text-text-secondary">Apagadas</span>
        </div>
      </div>

      {/* Charts / empty state */}
      <div className="px-4 pt-3 pb-3">
        {encendidas.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">Sin VMs encendidas</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricComponent
              data={vmData.map((d) => ({ name: d.name, value: d.cores }))}
              label="Cores" unit="cores"
              color="var(--color-brand)"
              total={totalCores}
            />
            <MetricComponent
              data={vmData.map((d) => ({ name: d.name, value: d.ram }))}
              label="RAM" unit="GB"
              color="#7c3aed"
              total={totalRam}
            />
            <MetricComponent
              data={vmData.map((d) => ({ name: d.name, value: d.disk }))}
              label="Disco" unit="GB"
              color="#0891b2"
              total={totalDisk}
            />
          </div>
        )}
      </div>
    </section>
  );
}
