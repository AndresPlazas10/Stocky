import type { ProveedorRecord } from '../../services/proveedoresService';

export type ProveedorFormState = {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  nit: string;
  notes: string;
};

export const SUPPLIERS_PAGE_SIZE = 40;

export const INITIAL_FORM: ProveedorFormState = {
  business_name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  nit: '',
  notes: '',
};

export function normalizeRole(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function createFormFromSupplier(supplier: ProveedorRecord): ProveedorFormState {
  return {
    business_name: supplier.business_name || '',
    contact_name: supplier.contact_name || '',
    email: supplier.email || '',
    phone: supplier.phone || '',
    address: supplier.address || '',
    nit: supplier.nit || '',
    notes: supplier.notes || '',
  };
}
