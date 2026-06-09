export type EmployeeFormState = {
  full_name: string;
  username: string;
  password: string;
};

export const INITIAL_FORM: EmployeeFormState = {
  full_name: '',
  username: '',
  password: '',
};

export const EMPLOYEES_PAGE_SIZE = 40;

export function normalizeRole(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function formatRoleLabel(role: string): string {
  const normalized = normalizeRole(role);
  if (normalized === 'owner' || normalized === 'propietario') return 'Propietario';
  if (normalized === 'admin' || normalized === 'administrador') return 'Administrador';
  return 'Empleado';
}
