export function isAdminRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return normalizedRole === 'owner'
    || normalizedRole === 'admin'
    || normalizedRole === 'administrador'
    || normalizedRole === 'propietario'
    || normalizedRole.includes('admin');
}
