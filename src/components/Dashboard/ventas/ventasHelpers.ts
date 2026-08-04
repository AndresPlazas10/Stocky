const getVendedorName = (sale: any, t: any): string => {
  if (sale?.employees?.role === 'owner' || sale?.employees?.role === 'admin') {
    return t('roles.admin', { ns: 'common' });
  }

  if (sale?.seller_name && typeof sale.seller_name === 'string' && sale.seller_name.trim() !== '') {
    return sale.seller_name;
  }
  
  if (!sale.employees) return t('roles.employee', { ns: 'common' });
  if (sale.employees.role === 'owner' || sale.employees.role === 'admin') return t('roles.admin', { ns: 'common' });
  return sale.employees.full_name || t('roles.employee', { ns: 'common' });
};

const buildDiagnosticAlertMessage = (errorLike: any, fallback = 'Error desconocido'): string => {
  const message = String(errorLike?.message || errorLike || fallback).trim() || fallback;
  const code = String(errorLike?.code || '').trim();
  const status = String(errorLike?.status || errorLike?.statusCode || '').trim();
  const hint = String(errorLike?.hint || '').trim();
  const details = String(errorLike?.details || '').trim();

  const diagnosticParts = [
    code ? `code=${code}` : null,
    status ? `status=${status}` : null,
    hint ? `hint=${hint}` : null,
    details ? `details=${details}` : null
  ].filter(Boolean);

  if (diagnosticParts.length === 0) return `❌ ${message}`;
  return `❌ ${message} [diag: ${diagnosticParts.join(' | ')}]`;
};

const getActionableSyncErrorMessage = (errorLike: any, t: any): string => {
  const message = String(errorLike || '').trim();
  const normalized = message.toLowerCase();

  if (normalized.includes('idx_sales_prevent_duplicates')) {
    return t('ventas:errors.alreadySynced');
  }

  if (normalized.includes('sesión no válida') || normalized.includes('sesion no valida') || normalized.includes('unauthorized')) {
    return t('ventas:errors.invalidSession');
  }

  if (normalized.includes('permission denied') || normalized.includes('row-level security') || normalized.includes('forbidden')) {
    return t('ventas:errors.noPermission');
  }

  if (normalized.includes('datos de venta inválidos') || normalized.includes('datos de venta invalidos') || normalized.includes('item inválido') || normalized.includes('item invalido')) {
    return t('ventas:errors.invalidData');
  }

  return message || t('ventas:errors.syncFailed');
};

const toNumberOrNull = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getSaleDetailDisplayName = (detail: any, t: any): string => (
  detail?.products?.name
  || detail?.combos?.nombre
  || detail?.combos?.name
  || detail?.product_name
  || t('ventas:labels.item')
);

export {
  getVendedorName,
  buildDiagnosticAlertMessage,
  getActionableSyncErrorMessage,
  toNumberOrNull,
  getSaleDetailDisplayName,
};
