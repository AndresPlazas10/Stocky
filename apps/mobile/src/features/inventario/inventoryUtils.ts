import i18next from 'i18next';
import type {
  InventoryProductRecord,
  InventorySupplierRecord,
} from '../../services/inventoryService';

export const PRODUCT_CATEGORIES = [
  { value: 'abarrotes', labelKey: 'categories.abarrotes' },
  { value: 'aseo', labelKey: 'categories.aseo' },
  { value: 'bebidas', labelKey: 'categories.bebidas' },
  { value: 'bebidas_alcoholicas', labelKey: 'categories.bebidas_alcoholicas' },
  { value: 'cervezas_vinos', labelKey: 'categories.cervezas_vinos' },
  { value: 'cigarrillos', labelKey: 'categories.cigarrillos' },
  { value: 'embutidos', labelKey: 'categories.embutidos' },
  { value: 'granos', labelKey: 'categories.granos' },
  { value: 'enlatados', labelKey: 'categories.enlatados' },
  { value: 'lacteos', labelKey: 'categories.lacteos' },
  { value: 'licores', labelKey: 'categories.licores' },
  { value: 'platos', labelKey: 'categories.platos' },
  { value: 'snacks_comida', labelKey: 'categories.snacks_comida' },
  { value: 'otros', labelKey: 'categories.otros' },
];

export function getCategoryLabel(value: string): string {
  const cat = PRODUCT_CATEGORIES.find((c) => c.value === value);
  return cat ? i18next.t(cat.labelKey) : value;
}

export const UNIT_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'unit', labelKey: 'units.unit' },
  { value: 'kg', labelKey: 'units.kg' },
  { value: 'l', labelKey: 'units.l' },
  { value: 'box', labelKey: 'units.box' },
];

export function getUnitLabel(value: string): string {
  const unit = UNIT_OPTIONS.find((u) => u.value === value);
  return unit ? i18next.t(unit.labelKey) : value;
}

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
  if (!value) return i18next.t('form.notSpecified');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return i18next.t('form.notSpecified');
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

export function getSupplierDisplayName(
  supplier: InventorySupplierRecord | null | undefined,
): string {
  if (!supplier) return i18next.t('form.noSupplier');
  return supplier.business_name || supplier.contact_name || i18next.t('form.supplier');
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
