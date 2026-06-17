import type {
  InventoryProductRecord,
  InventorySupplierRecord,
} from '../../services/inventoryService';

export const INVENTORY_CATEGORY_OPTIONS = [
  'Platos',
  'Bebidas Alcohólicas',
  'Cervezas',
  'Vinos',
  'Licores',
  'Bebidas',
  'Snacks',
  'Comida',
  'Otros',
];

export const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'unit', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'l', label: 'Litro' },
  { value: 'box', label: 'Caja' },
];

export const INVENTORY_PAGE_SIZE = 40;

export type ProductFormState = {
  name: string;
  category: string;
  purchasePrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
  unit: string;
  supplierId: string;
  manageStock: boolean;
  isActive: boolean;
};

export const INITIAL_FORM: ProductFormState = {
  name: '',
  category: '',
  purchasePrice: '',
  salePrice: '',
  stock: '0',
  minStock: '5',
  unit: 'unit',
  supplierId: '',
  manageStock: true,
  isActive: true,
};

export function normalizeRole(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function parseMoneyText(value: string, fallback = 0): number {
  const raw = String(value || '')
    .trim()
    .replace(/\s+/g, '');
  const normalized = (() => {
    if (!raw) return '';
    if (raw.includes(',')) {
      return raw.replace(/\./g, '').replace(',', '.');
    }
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
      return raw.replace(/\./g, '');
    }
    return raw.replace(/,/g, '');
  })();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseIntegerText(value: string, fallback = 0): number {
  const parsed = Number(String(value || '').replace(/[^\d-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatInventoryDateTime(value: string | null): string {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

export function getSupplierDisplayName(
  supplier: InventorySupplierRecord | null | undefined,
): string {
  if (!supplier) return 'Sin proveedor';
  return supplier.business_name || supplier.contact_name || 'Proveedor';
}

export function hydrateProductsWithSuppliers(
  products: InventoryProductRecord[],
  suppliers: InventorySupplierRecord[],
): InventoryProductRecord[] {
  const supplierMap = new Map(
    (Array.isArray(suppliers) ? suppliers : []).map((supplier) => [supplier.id, supplier] as const),
  );
  return (Array.isArray(products) ? products : []).map((product) => {
    if (!product?.supplier_id) return { ...product, supplier: null };
    return {
      ...product,
      supplier: supplierMap.get(product.supplier_id) || product.supplier || null,
    };
  });
}
