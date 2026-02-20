import { supabase } from '../supabase/Client.jsx';

export const COMBO_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

export function normalizeComboStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === COMBO_STATUS.INACTIVE
    ? COMBO_STATUS.INACTIVE
    : COMBO_STATUS.ACTIVE;
}

function toPositiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} debe ser mayor a 0`);
  }
  return parsed;
}

function normalizeComboItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Debes agregar al menos un producto al combo');
  }

  const uniqueProductIds = new Set();

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

function normalizeComboPayload(payload = {}) {
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

export async function fetchCombos(businessId, { onlyActive = false } = {}) {
  if (!businessId) return [];

  let query = supabase
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
        producto_id,
        cantidad,
        products (
          id,
          name,
          code,
          stock,
          is_active,
          category
        )
      )
    `)
    .eq('business_id', businessId)
    .order('nombre', { ascending: true });

  if (onlyActive) {
    query = query.eq('estado', COMBO_STATUS.ACTIVE);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'No se pudieron cargar los combos');
  }

  return (data || []).map((combo) => ({
    ...combo,
    combo_items: (combo.combo_items || []).map((item) => ({
      ...item,
      producto: item.products || null
    }))
  }));
}

export async function fetchComboCatalog(businessId) {
  return fetchCombos(businessId, { onlyActive: true });
}

export async function createCombo(businessId, payload) {
  if (!businessId) throw new Error('businessId es obligatorio');

  const normalized = normalizeComboPayload(payload);

  const { data: createdCombo, error: comboError } = await supabase
    .from('combos')
    .insert([
      {
        business_id: businessId,
        nombre: normalized.nombre,
        precio_venta: normalized.precio_venta,
        descripcion: normalized.descripcion,
        estado: normalized.estado
      }
    ])
    .select('id')
    .maybeSingle();

  if (comboError || !createdCombo?.id) {
    throw new Error(comboError?.message || 'No se pudo crear el combo');
  }

  const rows = normalized.items.map((item) => ({
    combo_id: createdCombo.id,
    producto_id: item.producto_id,
    cantidad: item.cantidad
  }));

  const { error: itemsError } = await supabase.from('combo_items').insert(rows);

  if (itemsError) {
    // Best effort rollback para evitar combos huérfanos.
    await supabase.from('combos').delete().eq('id', createdCombo.id);
    throw new Error(itemsError.message || 'No se pudieron guardar los productos del combo');
  }

  return createdCombo.id;
}

export async function updateCombo(comboId, businessId, payload) {
  if (!comboId) throw new Error('comboId es obligatorio');
  if (!businessId) throw new Error('businessId es obligatorio');

  const normalized = normalizeComboPayload(payload);

  const { error: comboError } = await supabase
    .from('combos')
    .update({
      nombre: normalized.nombre,
      precio_venta: normalized.precio_venta,
      descripcion: normalized.descripcion,
      estado: normalized.estado,
      updated_at: new Date().toISOString()
    })
    .eq('id', comboId)
    .eq('business_id', businessId);

  if (comboError) {
    throw new Error(comboError.message || 'No se pudo actualizar el combo');
  }

  const { error: deleteItemsError } = await supabase
    .from('combo_items')
    .delete()
    .eq('combo_id', comboId);

  if (deleteItemsError) {
    throw new Error(deleteItemsError.message || 'No se pudieron actualizar los productos del combo');
  }

  const rows = normalized.items.map((item) => ({
    combo_id: comboId,
    producto_id: item.producto_id,
    cantidad: item.cantidad
  }));

  const { error: insertItemsError } = await supabase.from('combo_items').insert(rows);
  if (insertItemsError) {
    throw new Error(insertItemsError.message || 'No se pudieron guardar los productos del combo');
  }
}

export async function setComboStatus(comboId, businessId, status) {
  if (!comboId) throw new Error('comboId es obligatorio');
  if (!businessId) throw new Error('businessId es obligatorio');

  const normalizedStatus = normalizeComboStatus(status);

  const { error } = await supabase
    .from('combos')
    .update({
      estado: normalizedStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', comboId)
    .eq('business_id', businessId);

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el estado del combo');
  }
}

export async function deleteCombo(comboId, businessId) {
  if (!comboId) throw new Error('comboId es obligatorio');
  if (!businessId) throw new Error('businessId es obligatorio');

  const { data, error } = await supabase
    .from('combos')
    .delete()
    .eq('id', comboId)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '23503') {
      throw new Error('No se puede eliminar el combo porque tiene movimientos asociados. Puedes desactivarlo.');
    }
    throw new Error(error.message || 'No se pudo eliminar el combo');
  }

  if (!data?.id) {
    throw new Error('El combo no existe o no tienes permisos para eliminarlo');
  }
}
