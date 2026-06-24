import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';
import { readAdapter } from '../data/adapters/localAdapter.js';
import { invalidateComboCache } from '../data/adapters/cacheInvalidation.js';

export const COMBO_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const;

export type ComboStatusValue = typeof COMBO_STATUS[keyof typeof COMBO_STATUS];

interface ComboItemPayload {
  producto_id: string;
  cantidad: number;
}

interface NormalizedComboPayload {
  nombre: string;
  precio_venta: number;
  descripcion: string | null;
  estado: ComboStatusValue;
  items: ComboItemPayload[];
}

interface ComboCreateInput {
  nombre?: string;
  name?: string;
  precio_venta?: number;
  sale_price?: number;
  descripcion?: string;
  description?: string;
  estado?: string;
  status?: string;
  items?: Array<{
    producto_id?: string;
    product_id?: string;
    cantidad?: number;
    quantity?: number;
  }>;
}

interface ComboListItem {
  id: string;
  business_id: string;
  nombre: string;
  precio_venta: number;
  descripcion: string | null;
  estado: string;
  combo_items?: Array<{
    producto_id?: string;
    products?: unknown;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export function normalizeComboStatus(status: string | undefined | null): ComboStatusValue {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === COMBO_STATUS.INACTIVE
    ? COMBO_STATUS.INACTIVE
    : COMBO_STATUS.ACTIVE;
}

function toPositiveNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} debe ser mayor a 0`);
  }
  return parsed;
}

function normalizeComboItems(items: ComboCreateInput['items'] = []): ComboItemPayload[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Debes agregar al menos un producto al combo');
  }

  const uniqueProductIds = new Set<string>();

  const normalized = items.map((item, index) => {
    const productoId = String(item?.producto_id || item?.product_id || '').trim();
    if (!productoId) {
      throw new Error(`Selecciona un producto en la fila ${index + 1}`);
    }

    if (uniqueProductIds.has(productoId)) {
      throw new Error('No se permiten productos repetidos en el combo');
    }
    uniqueProductIds.add(productoId);

    const cantidad = toPositiveNumber(item?.cantidad ?? item?.quantity, 'La cantidad');

    return {
      producto_id: productoId,
      cantidad
    };
  });

  return normalized;
}

function normalizeComboPayload(payload: ComboCreateInput = {}): NormalizedComboPayload {
  const nombre = String(payload?.nombre || payload?.name || '').trim();
  if (!nombre) {
    throw new Error('El nombre del combo es obligatorio');
  }

  const precioVenta = toPositiveNumber(
    payload?.precio_venta ?? payload?.sale_price,
    'El precio de venta'
  );

  const descripcion = String(payload?.descripcion || payload?.description || '').trim() || null;
  const estado = normalizeComboStatus(payload?.estado || payload?.status);
  const items = normalizeComboItems(payload?.items || []);

  return {
    nombre,
    precio_venta: precioVenta,
    descripcion,
    estado,
    items
  };
}

export async function fetchCombos(
  businessId: string,
  { onlyActive = false } = {}
): Promise<ComboListItem[]> {
  if (!businessId) return [];

  const { data, error } = await readAdapter.getCombosByBusinessWithItems({
    businessId,
    onlyActive
  } as Parameters<typeof readAdapter.getCombosByBusinessWithItems>[0]);
  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los combos');
  }

  return ((data ?? []) as ComboListItem[]).map((combo) => ({
    ...combo,
    combo_items: (combo.combo_items || []).map((item) => ({
      ...item,
      producto: item.products || null
    }))
  }));
}

export async function fetchComboCatalog(businessId: string): Promise<ComboListItem[]> {
  return fetchCombos(businessId, { onlyActive: true });
}

export async function createCombo(businessId: string, payload: ComboCreateInput): Promise<string> {
  if (!businessId) throw new Error('businessId es obligatorio');

  const normalized = normalizeComboPayload(payload);

  const { data: createdCombo, error: comboError } = await supabaseAdapter.insertCombo({
    business_id: businessId,
    nombre: normalized.nombre,
    precio_venta: normalized.precio_venta,
    descripcion: normalized.descripcion,
    estado: normalized.estado
  });

  if (comboError || !createdCombo?.id) {
    throw new Error(comboError?.message || 'No se pudo crear el combo');
  }

  const rows = normalized.items.map((item) => ({
    combo_id: createdCombo.id,
    producto_id: item.producto_id,
    cantidad: item.cantidad
  }));

  const { error: itemsError } = await supabaseAdapter.insertComboItems(rows);

  if (itemsError) {
    await supabaseAdapter.deleteComboByBusinessAndId({
      comboId: createdCombo.id,
      businessId
    });
    throw new Error(itemsError.message || 'No se pudieron guardar los productos del combo');
  }

  await invalidateComboCache({ businessId, comboId: createdCombo.id } as Parameters<typeof invalidateComboCache>[0]);

  return createdCombo.id;
}

export async function updateCombo(
  comboId: string,
  businessId: string,
  payload: ComboCreateInput
): Promise<void> {
  if (!comboId) throw new Error('comboId es obligatorio');
  if (!businessId) throw new Error('businessId es obligatorio');

  const normalized = normalizeComboPayload(payload);

  const { error: comboError } = await supabaseAdapter.updateComboByBusinessAndId({
    comboId,
    businessId,
    payload: {
      nombre: normalized.nombre,
      precio_venta: normalized.precio_venta,
      descripcion: normalized.descripcion,
      estado: normalized.estado,
      updated_at: new Date().toISOString()
    }
  });

  if (comboError) {
    throw new Error(comboError.message || 'No se pudo actualizar el combo');
  }

  const { error: deleteItemsError } = await supabaseAdapter.deleteComboItemsByComboId(comboId);

  if (deleteItemsError) {
    throw new Error(deleteItemsError.message || 'No se pudieron actualizar los productos del combo');
  }

  const rows = normalized.items.map((item) => ({
    combo_id: comboId,
    producto_id: item.producto_id,
    cantidad: item.cantidad
  }));

  const { error: insertItemsError } = await supabaseAdapter.insertComboItems(rows);
  if (insertItemsError) {
    throw new Error(insertItemsError.message || 'No se pudieron guardar los productos del combo');
  }

  await invalidateComboCache({ businessId, comboId } as Parameters<typeof invalidateComboCache>[0]);
}

export async function setComboStatus(
  comboId: string,
  businessId: string,
  status: string
): Promise<void> {
  if (!comboId) throw new Error('comboId es obligatorio');
  if (!businessId) throw new Error('businessId es obligatorio');

  const normalizedStatus = normalizeComboStatus(status);

  const { error } = await supabaseAdapter.updateComboByBusinessAndId({
    comboId,
    businessId,
    payload: {
      estado: normalizedStatus,
      updated_at: new Date().toISOString()
    }
  });

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el estado del combo');
  }

  await invalidateComboCache({ businessId, comboId } as Parameters<typeof invalidateComboCache>[0]);
}

export async function deleteCombo(comboId: string, businessId: string): Promise<void> {
  if (!comboId) throw new Error('comboId es obligatorio');
  if (!businessId) throw new Error('businessId es obligatorio');

  const { data, error } = await supabaseAdapter.deleteComboByBusinessAndId({
    comboId,
    businessId,
    selectSql: 'id'
  });

  if (error) {
    if (error.code === '23503') {
      throw new Error('No se puede eliminar el combo porque tiene movimientos asociados. Puedes desactivarlo.');
    }
    throw new Error(error.message || 'No se pudo eliminar el combo');
  }

  if (!(data as unknown as { id?: string })?.id) {
    throw new Error('El combo no existe o no tienes permisos para eliminarlo');
  }

  await invalidateComboCache({ businessId, comboId } as Parameters<typeof invalidateComboCache>[0]);
}
