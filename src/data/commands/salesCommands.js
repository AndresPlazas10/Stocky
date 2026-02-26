import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { enqueueOutboxMutation } from '../../sync/outboxShadow.js';
import { createSaleOptimized } from '../../services/salesServiceOptimized.js';
import LOCAL_SYNC_CONFIG from '../../config/localSync.js';
import { getCurrentSession } from '../queries/authQueries.js';
import { runOutboxTick } from '../../sync/syncBootstrap.js';

function normalizeReference(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined') return null;
  return raw;
}

function normalizeOutboxSaleItem(item = {}) {
  const itemType = String(item?.item_type || '').trim().toLowerCase();
  const fallbackId = normalizeReference(item?.item_id || item?.id || null);

  let productId = normalizeReference(item?.product_id);
  let comboId = normalizeReference(item?.combo_id);

  if (!productId && !comboId) {
    if (itemType === 'combo') comboId = fallbackId;
    if (itemType === 'product') productId = fallbackId;
  }

  const quantity = Number(item?.quantity);
  const unitPrice = Number(item?.unit_price ?? item?.price);

  if ((!productId && !comboId) || (productId && comboId)) {
    throw new Error(
      `Item inválido en carrito: "${item?.name || 'sin nombre'}" ` +
      `(product_id=${productId || 'null'}, combo_id=${comboId || 'null'}, item_type=${itemType || 'null'})`
    );
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Cantidad inválida para "${item?.name || 'item'}"`);
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error(`Precio inválido para "${item?.name || 'item'}"`);
  }

  return {
    product_id: productId,
    combo_id: comboId,
    quantity,
    unit_price: unitPrice
  };
}

function buildLocalSaleId(mutationId) {
  return `local:${mutationId}`;
}

function canQueueLocalSales() {
  return Boolean(
    LOCAL_SYNC_CONFIG.enabled
    && LOCAL_SYNC_CONFIG.shadowWritesEnabled
    && LOCAL_SYNC_CONFIG.localWrites?.sales
  );
}

function shouldForceSalesLocalFirst() {
  return Boolean(
    canQueueLocalSales()
    && (
      LOCAL_SYNC_CONFIG.localWrites?.allLocalFirst
      || LOCAL_SYNC_CONFIG.localWrites?.salesLocalFirst
    )
  );
}

function isConnectivityError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
    || message.includes('fetch failed')
    || message.includes('network')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyRemoteSalePersistence({
  saleId,
  businessId,
  retries = 3,
  waitMs = 250
}) {
  if (!saleId || !businessId) {
    return { confirmed: false, indeterminate: true };
  }

  let sawReadError = false;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const { data, error } = await supabaseAdapter.getSaleSyncStateById({ saleId, businessId });
    if (!error && data?.id) {
      return { confirmed: true, indeterminate: false };
    }
    if (error) {
      sawReadError = true;
    }
    if (attempt < retries - 1) {
      await sleep(waitMs);
    }
  }

  return {
    confirmed: false,
    indeterminate: sawReadError
  };
}

async function enqueueOfflineSaleMutation({
  businessId,
  cart,
  paymentMethod,
  total,
  idempotencyKey
}) {
  if (!canQueueLocalSales()) {
    return {
      success: false,
      error: 'Las ventas offline no están habilitadas en esta configuración.'
    };
  }

  const normalizedItems = cart.map((item) => normalizeOutboxSaleItem(item));
  const fallbackTotal = normalizedItems.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)),
    0
  );
  const normalizedTotal = Number.isFinite(Number(total)) ? Number(total) : fallbackTotal;

  let userId = null;
  try {
    const session = await getCurrentSession();
    userId = session?.user?.id || null;
  } catch {
    userId = null;
  }

  const mutationId = idempotencyKey || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'sale.create',
    payload: {
      local_write: true,
      payment_method: paymentMethod,
      total: normalizedTotal,
      items_count: normalizedItems.length,
      items: normalizedItems,
      user_id: userId,
      idempotency_key: mutationId,
      created_at: new Date().toISOString()
    },
    mutationId
  });

  if (!queued) {
    return {
      success: false,
      error: 'No se pudo guardar la venta localmente. Intenta de nuevo.'
    };
  }

  return {
    success: true,
    localOnly: true,
    pendingSync: true,
    data: {
      id: buildLocalSaleId(mutationId),
      total: normalizedTotal,
      items_count: normalizedItems.length,
      created_at: new Date().toISOString()
    }
  };
}

export async function createSaleWithOutbox({
  businessId,
  cart,
  paymentMethod = 'cash',
  total = 0,
  idempotencyKey = null
}) {
  const forceLocalFirst = shouldForceSalesLocalFirst();
  if (forceLocalFirst) {
    const queuedResult = await enqueueOfflineSaleMutation({
      businessId,
      cart,
      paymentMethod,
      total,
      idempotencyKey
    });

    if (queuedResult?.success && typeof navigator !== 'undefined' && navigator.onLine) {
      // Mejor esfuerzo: intentar flush inmediato sin bloquear UX de caja.
      runOutboxTick().catch(() => {});
    }
    return queuedResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalSales()) {
    return enqueueOfflineSaleMutation({
      businessId,
      cart,
      paymentMethod,
      total,
      idempotencyKey
    });
  }

  const result = await createSaleOptimized({
    businessId,
    cart,
    paymentMethod,
    total,
    idempotencyKey
  });

  if (!result?.success) {
    if (canQueueLocalSales() && isConnectivityError(result?.error)) {
      return enqueueOfflineSaleMutation({
        businessId,
        cart,
        paymentMethod,
        total,
        idempotencyKey
      });
    }
    return result;
  }

  const saleId = result?.data?.id || null;
  const persistenceCheck = await verifyRemoteSalePersistence({
    saleId,
    businessId
  });
  if (!persistenceCheck.confirmed && !persistenceCheck.indeterminate) {
    return {
      success: false,
      error: 'La venta no se confirmó en Supabase. Verifica conexión y vuelve a intentar.'
    };
  }

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'sale.create',
    payload: {
      sale_id: saleId,
      payment_method: paymentMethod,
      total: Number(result?.data?.total ?? total ?? 0),
      items_count: Number(result?.data?.items_count ?? cart?.length ?? 0)
    },
    mutationId: saleId || idempotencyKey || `${businessId}:${Date.now()}:sale.create`
  });

  return result;
}

export async function deleteSaleWithDetails(saleId, businessId = null) {
  const { error: detailsError } = await supabaseAdapter.deleteSaleDetails(saleId);
  if (detailsError) {
    throw new Error(`Error al eliminar detalles: ${detailsError.message}`);
  }

  const { error: saleError } = await supabaseAdapter.deleteSaleById(saleId);
  if (saleError) {
    throw new Error(`Error al eliminar venta: ${saleError.message}`);
  }

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'sale.delete',
    payload: { sale_id: saleId },
    mutationId: saleId
  });
}
