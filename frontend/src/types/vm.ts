export type VMStatus = 'encendida' | 'apagada';

export interface VM {
  id: string;
  name: string;
  cores: number;
  ram_gb: number;
  disk_gb: number;
  os: string;
  status: VMStatus;
  created_at: string;
  updated_at: string;
}

export interface VMFormData {
  name: string;
  cores: number;
  ram_gb: number;
  disk_gb: number;
  os: string;
  status: VMStatus;
}

export const OS_OPTIONS = [
  'Ubuntu 22.04',
  'Windows Server 2022',
  'CentOS 8',
  'Debian 12',
  'Rocky Linux 9',
] as const;
