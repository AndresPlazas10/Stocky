import { normalizeNumber, normalizeText } from './normalization';
import type {
  MesaOrderCatalogItem,
  MesaOrderCombo,
  MesaOrderItem,
  MesaOrderProduct,
} from '../services/mesaOrderService';

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  error?: string;
};

export function normalizeOrderReference(value: unknown): string {
  return String(value || '').trim();
}

export function normalizeOrderItemQuantity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

export function normalizeOrderItemSubtotal(row: Record<string, unknown>): number {
  const subtotal = Number(row?.subtotal);
  if (Number.isFinite(subtotal)) {
    return Math.max(0, subtotal);
  }
  const quantity = normalizeOrderItemQuantity(row?.quantity);
  const price = Number(row?.price);
  const safePrice = Number.isFinite(price) ? price : 0;
  return Math.max(0, quantity * safePrice);
}

export function getOrderItemName(item: MesaOrderItem): string {
  return item?.products?.name || item?.combos?.nombre || 'Item';
}

export function calculateOrderTotal(items: MesaOrderItem[]): number {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) =>
      sum +
      normalizeNumber(item.quantity, 0) * normalizeNumber(item.price, 0),
    0,
  );
}

export function calculateOrderUnits(items: MesaOrderItem[]): number {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(0, Math.floor(normalizeNumber(item?.quantity, 0))),
    0,
  );
}

export function sumOrderItemsQuantity(items: MesaOrderItem[]): number {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity || 0)),
    0,
  );
}

export function calculateCashChange(
  total: number,
  amountReceived: string | number | null | undefined,
) {
  const normalizedTotal = Math.round(normalizeNumber(total, 0));
  const raw = String(amountReceived ?? '')
    .trim()
    .replace(/\s|\$/g, '');
  const normalizedPaid = raw ? Number(raw.replace(/\./g, '').replace(',', '.')) : NaN;

  if (!Number.isFinite(normalizedPaid)) {
    return { isValid: false, change: 0, paid: 0, reason: 'invalid' as const };
  }
  if (normalizedPaid < normalizedTotal) {
    return { isValid: false, change: 0, paid: normalizedPaid, reason: 'insufficient' as const };
  }

  return {
    isValid: true,
    change: Math.round(normalizedPaid - normalizedTotal),
    paid: Math.round(normalizedPaid),
    reason: null,
  } as const;
}

export function normalizeJsonArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

export function normalizeProduct(row: Record<string, unknown>): MesaOrderProduct {
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

export function normalizeCombo(row: Record<string, unknown>): MesaOrderCombo {
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

export function normalizeOrderItem(row: Record<string, unknown>): MesaOrderItem {
  const quantity = normalizeNumber(row?.quantity, 0);
  const price = normalizeNumber(row?.price, 0);
  const subtotal = normalizeNumber(row?.subtotal, quantity * price);

  const productRecord =
    row.products && typeof row.products === 'object' && row.products !== null
      ? (row.products as Record<string, unknown>)
      : null;
  const comboRecord =
    row.combos && typeof row.combos === 'object' && row.combos !== null
      ? (row.combos as Record<string, unknown>)
      : null;

  return {
    id: normalizeText(row?.id),
    order_id: normalizeText(row?.order_id),
    product_id: row?.product_id ? String(row.product_id) : null,
    combo_id: row?.combo_id ? String(row.combo_id) : null,
    quantity,
    price,
    subtotal,
    products: productRecord
      ? {
          id: productRecord.id ? String(productRecord.id) : undefined,
          name: productRecord.name ? String(productRecord.name) : undefined,
          code: productRecord.code ? String(productRecord.code) : undefined,
          category: productRecord.category ? String(productRecord.category) : undefined,
        }
      : null,
    category: productRecord?.category ? String(productRecord.category) : undefined,
    combos: comboRecord
      ? {
          id: comboRecord.id ? String(comboRecord.id) : undefined,
          nombre: comboRecord.nombre ? String(comboRecord.nombre) : undefined,
        }
      : null,
  };
}

export function reconcileOrderItemsFromServer(
  current: MesaOrderItem[],
  fromServer: MesaOrderItem[],
): MesaOrderItem[] {
  const local = Array.isArray(current) ? current : [];
  const server = Array.isArray(fromServer) ? fromServer : [];

  const serverById = new Map<string, MesaOrderItem>();
  for (const item of server) {
    const id = String(item.id || '');
    if (id) serverById.set(id, item);
  }

  const usedServerIds = new Set<string>();
  const merged: MesaOrderItem[] = [];

  for (const localItem of local) {
    const localId = String(localItem.id || '');
    const serverItem = localId ? serverById.get(localId) : undefined;

    if (serverItem) {
      merged.push(serverItem);
      usedServerIds.add(localId);
    } else {
      const identityKey = localItem.product_id || localItem.combo_id || '';
      const serverMatch = identityKey
        ? server.find(
            (s) =>
              !usedServerIds.has(String(s.id || '')) &&
              (s.product_id === identityKey || s.combo_id === identityKey),
          )
        : undefined;

      if (serverMatch) {
        merged.push(serverMatch);
        usedServerIds.add(String(serverMatch.id || ''));
      } else {
        merged.push(localItem);
      }
    }
  }

  server.forEach((serverItem) => {
    const serverId = String(serverItem.id || '');
    if (!serverId || usedServerIds.has(serverId)) return;
    merged.push(serverItem);
  });

  return merged;
}

export function compareCatalogNames(left: MesaOrderCatalogItem, right: MesaOrderCatalogItem): number {
  const leftName = String(left?.name || '').trim();
  const rightName = String(right?.name || '').trim();
  return leftName.localeCompare(rightName, 'es', { sensitivity: 'base' });
}

export function mergeCatalogByName(
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
