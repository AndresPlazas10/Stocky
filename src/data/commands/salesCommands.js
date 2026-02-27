import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { createSaleOptimized } from '../../services/salesServiceOptimized.js';

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

export async function createSaleWithOutbox({
  businessId,
  cart,
  paymentMethod = 'cash',
  total = 0,
  idempotencyKey = null
}) {
  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode) {
    return {
      success: false,
      error: 'Perdiste la conexión, intentando reconectar...'
    };
  }

  const result = await createSaleOptimized({
    businessId,
    cart,
    paymentMethod,
    total,
    idempotencyKey
  });

  if (!result?.success) {
    if (isConnectivityError(result?.error)) {
      return {
        success: false,
        error: 'Perdiste la conexión, intentando reconectar...'
      };
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
  void businessId;
}
