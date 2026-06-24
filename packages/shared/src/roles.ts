/**
 * Checks if a role string represents an admin-level role.
 * Supports English and Spanish role names.
 * @param role - The role string to check
 * @returns true if the role is an admin-level role
 */
export function isAdminRole(role: string | null | undefined): boolean {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return normalizedRole === 'owner'
    || normalizedRole === 'admin'
    || normalizedRole === 'administrador'
    || normalizedRole === 'propietario'
    || normalizedRole.includes('admin');
}
