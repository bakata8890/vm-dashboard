import { useVMs } from '@/hooks/useVMs';
import { VMCard } from '@/components/vms/VMCard';
import { VMCardSkeleton } from '@/components/vms/VMCardSkeleton';
import { VMEmptyState } from '@/components/vms/VMEmptyState';

export function VMList() {
  const { data: vms, isLoading, isError, refetch } = useVMs();

  // Todos los hooks declarados antes de cualquier return condicional (lección módulo 1)
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => <VMCardSkeleton key={i} />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="mb-4 text-text-secondary">No se pudieron cargar las VMs.</p>
        <button
          onClick={() => refetch()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!vms || vms.length === 0) {
    return <VMEmptyState />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vms.map((vm) => <VMCard key={vm.id} vm={vm} />)}
    </div>
  );
}
