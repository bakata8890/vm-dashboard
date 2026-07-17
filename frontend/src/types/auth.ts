export type Role = 'admin' | 'cliente';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
