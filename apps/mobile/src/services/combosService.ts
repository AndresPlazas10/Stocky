import { getSupabaseClient } from '../lib/supabase';

export const COMBO_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type ComboStatus = typeof COMBO_STATUS[keyof typeof COMBO_STATUS];

export type ComboProductRecord = {
  id: string;
  code: string | null;
  name: string;
  sale_price: number;
  stock: number;
  category: string | null;
  is_active: boolean;
  manage_stock: boolean;
};

export type ComboItemRecord = {
  id: string;
  combo_id: string;
  producto_id: string;
  cantidad: number;
  product: ComboProductRecord | null;
};

export type ComboRecord = {
  id: string;
  business_id: string;
  nombre: string;
  precio_venta: number;
  descripcion: string | null;
  estado: ComboStatus;
  created_at: string | null;
  combo_items: ComboItemRecord[];
};

export type ComboUpsertItem = {
  producto_id: string;
  cantidad: number;
};

export type ComboUpsertPayload = {
  nombre: string;
  precio_venta: number;
  descripcion?: string | null;
  estado?: ComboStatus;
  items: ComboUpsertItem[];
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeReference(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return normalized;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} debe ser mayor a 0.`);
  }
  return parsed;
}

function normalizeComboStatus(value: unknown): ComboStatus {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === COMBO_STATUS.INACTIVE ? COMBO_STATUS.INACTIVE : COMBO_STATUS.ACTIVE;
}

function normalizeComboProduct(row: any): ComboProductRecord {
  return {
    id: normalizeText(row?.id),
    code: normalizeReference(row?.code),
    name: normalizeText(row?.name) || 'Producto',
    sale_price: normalizeNumber(row?.sale_price, 0),
    stock: normalizeNumber(row?.stock, 0),
    category: normalizeReference(row?.category),
    is_active: row?.is_active !== false,
    manage_stock: row?.manage_stock !== false,
  };
}

function normalizeComboItem(row: any): ComboItemRecord {
  return {
    id: normalizeText(row?.id),
    combo_id: normalizeText(row?.combo_id),
    producto_id: normalizeText(row?.producto_id),
    cantidad: normalizeNumber(row?.cantidad, 0),
    product: row?.products ? normalizeComboProduct(row.products) : null,
  };
}

function normalizeComboRow(row: any): ComboRecord {
  return {
    id: normalizeText(row?.id),
    business_id: normalizeText(row?.business_id),
    nombre: normalizeText(row?.nombre) || 'Combo',
    precio_venta: normalizeNumber(row?.precio_venta, 0),
    descripcion: normalizeReference(row?.descripcion),
    estado: normalizeComboStatus(row?.estado),
    created_at: normalizeReference(row?.created_at),
    combo_items: (Array.isArray(row?.combo_items) ? row.combo_items : []).map(normalizeComboItem),
  };
}

function normalizeComboItems(items: ComboUpsertItem[]): ComboUpsertItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Debes agregar al menos un producto al combo.');
  }

  const seen = new Set<string>();
  return items.map((item, index) => {
    const productoId = normalizeText(item?.producto_id);
    if (!productoId) {
      throw new Error(`Selecciona un producto en la fila ${index + 1}.`);
    }

    if (seen.has(productoId)) {
      throw new Error('No se permiten productos repetidos en el combo.');
    }
    seen.add(productoId);

    return {
      producto_id: productoId,
      cantidad: toPositiveNumber(item?.cantidad, 'La cantidad'),
    };
  });
}

function normalizeComboPayload(payload: ComboUpsertPayload) {
  const nombre = normalizeText(payload?.nombre);
  if (!nombre) {
    throw new Error('El nombre del combo es obligatorio.');
  }

  const precioVenta = toPositiveNumber(payload?.precio_venta, 'El precio de venta');
  const descripcion = normalizeReference(payload?.descripcion);
  const estado = normalizeComboStatus(payload?.estado);
  const items = normalizeComboItems(payload?.items || []);

  return {
    nombre,
    precio_venta: precioVenta,
    descripcion,
    estado,
    items,
  };
}

export async function listComboProducts(businessId: string): Promise<ComboProductRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('products')
    .select('id,code,name,sale_price,stock,category,is_active,manage_stock')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(200);

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeComboProduct);
}

export async function listCombosByBusiness(
  businessId: string,
  options: { onlyActive?: boolean } = {},
): Promise<ComboRecord[]> {
  const client = getSupabaseClient();
  let query = client
    .from('combos')
    .select(`
      id,
      business_id,
      nombre,
      precio_venta,
      descripcion,
      estado,
      created_at,
      combo_items (
        id,
        combo_id,
        producto_id,
        cantidad,
        products (
          id,
          code,
          name,
          sale_price,
          stock,
          category,
          is_active,
          manage_stock
        )
      )
    `)
    .eq('business_id', businessId)
    .order('nombre', { ascending: true });

  if (options.onlyActive) {
    query = query.eq('estado', COMBO_STATUS.ACTIVE);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeComboRow);
}

export async function createComboByBusinessId(
  businessId: string,
  payload: ComboUpsertPayload,
): Promise<{ comboId: string | null }> {
  const normalized = normalizeComboPayload(payload);
  const client = getSupabaseClient();

  const comboInsert = await client
    .from('combos')
    .insert([
      {
        business_id: businessId,
        nombre: normalized.nombre,
        precio_venta: normalized.precio_venta,
        descripcion: normalized.descripcion,
        estado: normalized.estado,
      },
    ])
    .select('id')
    .maybeSingle();

  if (comboInsert.error || !comboInsert.data?.id) {
    throw new Error(comboInsert.error?.message || 'No se pudo crear el combo.');
  }

  const comboId = normalizeReference(comboInsert.data.id);
  const rows = normalized.items.map((item) => ({
    combo_id: comboId,
    producto_id: item.producto_id,
    cantidad: item.cantidad,
  }));

  const itemsInsert = await client
    .from('combo_items')
    .insert(rows);

  if (itemsInsert.error) {
    await client
      .from('combos')
      .delete()
      .eq('id', comboId)
      .eq('business_id', businessId);
    throw new Error(itemsInsert.error.message || 'No se pudieron guardar los productos del combo.');
  }

  return { comboId };
}

export async function updateComboByBusinessAndId({
  businessId,
  comboId,
  payload,
}: {
  businessId: string;
  comboId: string;
  payload: ComboUpsertPayload;
}): Promise<void> {
  const normalized = normalizeComboPayload(payload);
  const client = getSupabaseClient();

  const comboUpdate = await client
    .from('combos')
    .update({
      nombre: normalized.nombre,
      precio_venta: normalized.precio_venta,
      descripcion: normalized.descripcion,
      estado: normalized.estado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', comboId)
    .eq('business_id', businessId);

  if (comboUpdate.error) {
    throw new Error(comboUpdate.error.message || 'No se pudo actualizar el combo.');
  }

  const deleteItems = await client
    .from('combo_items')
    .delete()
    .eq('combo_id', comboId);

  if (deleteItems.error) {
    throw new Error(deleteItems.error.message || 'No se pudieron actualizar los productos del combo.');
  }

  const rows = normalized.items.map((item) => ({
    combo_id: comboId,
    producto_id: item.producto_id,
    cantidad: item.cantidad,
  }));

  const insertItems = await client
    .from('combo_items')
    .insert(rows);

  if (insertItems.error) {
    throw new Error(insertItems.error.message || 'No se pudieron guardar los productos del combo.');
  }
}

export async function setComboStatusByBusinessAndId({
  businessId,
  comboId,
  status,
}: {
  businessId: string;
  comboId: string;
  status: ComboStatus;
}): Promise<void> {
  const normalizedStatus = normalizeComboStatus(status);
  const client = getSupabaseClient();
  const { error } = await client
    .from('combos')
    .update({
      estado: normalizedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', comboId)
    .eq('business_id', businessId);

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el estado del combo.');
  }
}

export async function deleteComboByBusinessAndId({
  businessId,
  comboId,
}: {
  businessId: string;
  comboId: string;
}): Promise<void> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('combos')
    .delete()
    .eq('id', comboId)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle();

  if (error) {
    if ((error as any)?.code === '23503') {
      throw new Error('No se puede eliminar el combo porque tiene movimientos asociados. Puedes desactivarlo.');
    }
    throw new Error(error.message || 'No se pudo eliminar el combo.');
  }

  if (!data?.id) {
    throw new Error('El combo no existe o no tienes permisos para eliminarlo.');
  }
}
