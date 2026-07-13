export const TERMS_URL = 'https://www.stockypos.app/legal/terms.html';
export const PRIVACY_URL = 'https://www.stockypos.app/legal/privacy.html';
export const DELETE_ACCOUNT_URL = 'https://www.stockypos.app/legal/delete-account.html';

export type BusinessFormState = {
  nit: string;
  phone: string;
  address: string;
};

export function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function getProfileLabel(source: 'owner' | 'employee' | 'unknown' | null) {
  if (source === 'owner') return 'Propietario';
  if (source === 'employee') return 'Empleado';
  return 'Desconocido';
}

export function shortenUserId(value: string) {
  if (!value) return 'n/a';
  if (value.length <= 28) return value;
  return `${value.slice(0, 28)}...`;
}

export function createInitialBusinessForm(): BusinessFormState {
  return {
    nit: '',
    phone: '',
    address: '',
  };
}
