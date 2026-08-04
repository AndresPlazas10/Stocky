import { getSupabaseClient } from '../../lib/supabase';
import { normalizeText, normalizeNumber } from '../../utils/normalization';
import { emitCatalogInvalidated } from '../../utils/catalogEvents';
import { clearCatalogFromStorage } from '../../features/mesas/utils/catalogCache';
import { normalizeBusinessId } from './internal';
import type { MesaOrderProduct, MesaOrderCombo, MesaOrderCatalogItem, ListCatalogItemsOptions } from './types';

const DEFAULT_CATALOG_CACHE_TTL_MS = 60_000;
const catalogCacheByBusinessId = new Map<
  string,
  {
    items: MesaOrderCatalogItem[];
    cachedAt: number;
  }
>();
const catalogInFlightByBusinessId = new Map<string, Promise<MesaOrderCatalogItem[]>>();

function compareCatalogNames(left: MesaOrderCatalogItem, right: MesaOrderCatalogItem): number {
  const leftName = String(left?.name || '').trim();
  const rightName = String(right?.name || '').trim();
  return leftName.localeCompare(rightName, 'es', { sensitivity: 'base' });
}

function mergeCatalogByName(
  products: MesaOrderProduct[],
  combos: MesaOrderCombo[],
): MesaOrderCatalogItem[] {
  const merged: MesaOrderCatalogItem[] = [];
  let i = 0;
  let j = 0;

  while (i < products.length && j < combos.length) {
    const product = products[i];
    const combo = combos[j];
    if (compareCatalogNames(product, combo) <= 0) {
      merged.push(product);
      i += 1;
    } else {
      merged.push(combo);
      j += 1;
    }
  }

  while (i < products.length) {
    merged.push(products[i]);
    i += 1;
  }

  while (j < combos.length) {
    merged.push(combos[j]);
    j += 1;
  }

  return merged;
}

function normalizeProduct(row: Record<string, unknown>): MesaOrderProduct {
  const id = normalizeText(row?.id);
  return {
    id,
    item_type: 'product',
    product_id: id,
    combo_id: null,
    name: normalizeText(row?.name, 'Producto'),
    code: row?.code ? String(row.code) : null,
    category: row?.category ? String(row.category) : null,
    sale_price: normalizeNumber(row?.sale_price, 0),
    stock: normalizeNumber(row?.stock, 0),
    manage_stock: row?.manage_stock !== false,
    combo_items: [],
  };
}

function normalizeCombo(row: Record<string, unknown>): MesaOrderCombo {
  const id = normalizeText(row?.id);
  const comboItemsSource = Array.isArray(row?.combo_items) ? row.combo_items : [];

  return {
    id,
    item_type: 'combo',
    product_id: null,
    combo_id: id,
    name: normalizeText(row?.nombre || row?.name, 'Combo'),
    code: null,
    sale_price: normalizeNumber(row?.precio_venta ?? row?.sale_price, 0),
    stock: null,
    manage_stock: false,
    combo_items: comboItemsSource
      .map((item) => {
        const itemRecord = item as Record<string, unknown>;
        const productRecord =
          itemRecord.products &&
          typeof itemRecord.products === 'object' &&
          itemRecord.products !== null
            ? (itemRecord.products as Record<string, unknown>)
            : null;
        return {
          producto_id: normalizeText(itemRecord?.producto_id),
          cantidad: normalizeNumber(itemRecord?.cantidad, 0),
          products: productRecord
            ? {
                id: productRecord.id ? String(productRecord.id) : undefined,
                name: productRecord.name ? String(productRecord.name) : undefined,
                stock: normalizeNumber(productRecord.stock, 0),
                manage_stock: productRecord.manage_stock !== false,
              }
            : null,
        };
      })
      .filter((item) => item.producto_id && item.cantidad > 0),
  };
}

function hydrateComboComponentsWithProducts(
  combos: MesaOrderCombo[],
  products: MesaOrderProduct[],
): MesaOrderCombo[] {
  const productById = new Map<string, MesaOrderProduct>();
  (Array.isArray(products) ? products : []).forEach((product) => {
    const productId = normalizeText(product?.product_id);
    if (!productId) return;
    productById.set(productId, product);
  });

  return (Array.isArray(combos) ? combos : []).map((combo) => ({
    ...combo,
    combo_items: (Array.isArray(combo.combo_items) ? combo.combo_items : []).map((component) => {
      if (component?.products) return component;
      const productId = normalizeText(component?.producto_id);
      const product = productById.get(productId);
      if (!product) return component;
      return {
        ...component,
        products: {
          id: product.product_id,
          name: product.name,
          stock: product.stock,
          manage_stock: product.manage_stock,
        },
      };
    }),
  }));
}

export function invalidateCatalogItemsCache(businessId?: string) {
  const normalizedBusinessId = normalizeBusinessId(businessId);
  if (normalizedBusinessId) {
    catalogCacheByBusinessId.delete(normalizedBusinessId);
    catalogInFlightByBusinessId.delete(normalizedBusinessId);
    void clearCatalogFromStorage(normalizedBusinessId);
    emitCatalogInvalidated();
    return;
  }

  catalogCacheByBusinessId.clear();
  catalogInFlightByBusinessId.clear();
  emitCatalogInvalidated();
}

export async function listProductsForMesaOrder(businessId: string): Promise<MesaOrderProduct[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('products')
    .select('id, code, name, category, sale_price, stock, manage_stock')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(300);

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeProduct);
}

export async function listCombosForMesaOrder(businessId: string): Promise<MesaOrderCombo[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('combos')
    .select(
      `
      id,
      nombre,
      precio_venta,
      estado,
      combo_items (
        producto_id,
        cantidad
      )
    `,
    )
    .eq('business_id', businessId)
    .order('nombre', { ascending: true })
    .limit(200);

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .filter((row) => String(row?.estado || 'active').toLowerCase() !== 'inactive')
    .map(normalizeCombo);
}

export async function listCatalogItems(
  businessId: string,
  options?: ListCatalogItemsOptions,
): Promise<MesaOrderCatalogItem[]> {
  const normalizedBusinessId = normalizeBusinessId(businessId);
  if (!normalizedBusinessId) return [];

  const forceRefresh = options?.forceRefresh === true;
  const ttlMs = Number.isFinite(Number(options?.ttlMs))
    ? Math.max(1_000, Number(options?.ttlMs))
    : DEFAULT_CATALOG_CACHE_TTL_MS;

  if (!forceRefresh) {
    const cached = catalogCacheByBusinessId.get(normalizedBusinessId);
    if (cached && Date.now() - cached.cachedAt <= ttlMs) {
      return cached.items;
    }
  }

  const inFlight = catalogInFlightByBusinessId.get(normalizedBusinessId);
  if (inFlight) return inFlight;

  const loadPromise = Promise.all([
    listProductsForMesaOrder(normalizedBusinessId),
    listCombosForMesaOrder(normalizedBusinessId),
  ])
    .then(([products, combos]) => {
      const hydratedCombos = hydrateComboComponentsWithProducts(combos, products);
      const merged = mergeCatalogByName(products, hydratedCombos);

      catalogCacheByBusinessId.set(normalizedBusinessId, {
        items: merged,
        cachedAt: Date.now(),
      });
      return merged;
    })
    .finally(() => {
      if (catalogInFlightByBusinessId.get(normalizedBusinessId) === loadPromise) {
        catalogInFlightByBusinessId.delete(normalizedBusinessId);
      }
    });

  catalogInFlightByBusinessId.set(normalizedBusinessId, loadPromise);
  return loadPromise;
}


