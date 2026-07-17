import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ResourcesPanel } from '@/components/charts/ResourcesPanel';
import { VMList } from '@/components/vms/VMList';
import { VMFormModal } from '@/components/vms/VMFormModal';
import { DeleteConfirmModal } from '@/components/vms/DeleteConfirmModal';
import { useVMWebSocket } from '@/hooks/useVMWebSocket';

export function DashboardPage() {
  useVMWebSocket();

  return (
    <DashboardLayout>
      <ResourcesPanel />
      <VMList />
      <VMFormModal />
      <DeleteConfirmModal />
    </DashboardLayout>
  );
}
