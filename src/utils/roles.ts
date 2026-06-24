export function isAdminRole(role: string | null | undefined): boolean {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return normalizedRole === 'owner'
    || normalizedRole === 'admin'
    || normalizedRole === 'administrador'
    || normalizedRole === 'propietario'
    || normalizedRole.includes('admin');
}
