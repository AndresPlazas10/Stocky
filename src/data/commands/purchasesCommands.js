import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { enqueueOutboxMutation } from '../../sync/outboxShadow.js';
import LOCAL_SYNC_CONFIG from '../../config/localSync.js';
import { runOutboxTick } from '../../sync/syncBootstrap.js';
import { getCurrentSession } from '../queries/authQueries.js';

function buildLocalPurchaseId(mutationId) {
  return `local:${mutationId}`;
}

function canQueueLocalPurchases() {
  return Boolean(
    LOCAL_SYNC_CONFIG.enabled
    && LOCAL_SYNC_CONFIG.shadowWritesEnabled
    && LOCAL_SYNC_CONFIG.localWrites?.purchases
  );
}

function shouldForcePurchasesLocalFirst() {
  return Boolean(
    canQueueLocalPurchases()
    && (
      LOCAL_SYNC_CONFIG.localWrites?.allLocalFirst
      || LOCAL_SYNC_CONFIG.localWrites?.purchasesLocalFirst
    )
  );
}

function normalizePurchasePaymentMethod(paymentMethod) {
  const normalized = String(paymentMethod || '').trim().toLowerCase();
  if (!normalized) return 'cash';
  if (normalized === 'efectivo') return 'cash';
  if (normalized === 'tarjeta') return 'card';
  if (normalized === 'transferencia') return 'transfer';
  return normalized;
}

function isConnectivityError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('load failed')
    || message.includes('network')
  );
}

function normalizePurchaseItemsForOutbox(cart = []) {
  const sourceItems = Array.isArray(cart) ? cart : [];
  return sourceItems.map((item = {}) => {
    const productId = String(item?.product_id || '').trim() || null;
    const quantity = Number(item?.quantity);
    const unitCost = Number(item?.unit_price);

    if (!productId) {
      throw new Error('Item inválido: falta product_id');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Item inválido: cantidad incorrecta');
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new Error('Item inválido: costo unitario incorrecto');
    }

    return {
      product_id: productId,
      quantity,
      unit_cost: unitCost
    };
  });
}

async function assertPurchasableProductsManageStock({ businessId, cart = [] }) {
  const sourceItems = Array.isArray(cart) ? cart : [];
  if (sourceItems.length === 0) return;

  const localBlocked = sourceItems.filter((item) => item?.manage_stock === false);
  if (localBlocked.length > 0) {
    const names = localBlocked
      .map((item) => String(item?.product_name || item?.product_id || '').trim())
      .filter(Boolean)
      .slice(0, 3);
    throw new Error(
      `No puedes registrar compras de productos sin control de stock${names.length ? `: ${names.join(', ')}` : ''}.`
    );
  }

  const unknownIds = [...new Set(
    sourceItems
      .filter((item) => item?.manage_stock === undefined || item?.manage_stock === null)
      .map((item) => String(item?.product_id || '').trim())
      .filter(Boolean)
  )];
  if (unknownIds.length === 0) return;

  const { data: productRows, error } = await supabaseAdapter.getProductsByBusinessAndIds(businessId, unknownIds);
  if (error) throw error;

  const stockControlById = new Map(
    (productRows || []).map((product) => [
      String(product.id),
      product.manage_stock !== false
    ])
  );

  const blockedIds = unknownIds.filter((id) => stockControlById.get(id) === false);
  if (blockedIds.length > 0) {
    throw new Error('No puedes registrar compras de productos sin control de stock.');
  }
}

async function enqueueOfflinePurchaseMutation({
  businessId,
  userId = null,
  supplierId,
  paymentMethod,
  notes,
  total,
  cart,
  idempotencyKey = null
}) {
  if (!canQueueLocalPurchases()) {
    return {
      success: false,
      error: 'Las compras offline no están habilitadas en esta configuración.'
    };
  }

  const normalizedItems = normalizePurchaseItemsForOutbox(cart);
  const fallbackTotal = normalizedItems.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)),
    0
  );
  const normalizedTotal = Number.isFinite(Number(total)) ? Number(total) : fallbackTotal;
  const normalizedPaymentMethod = normalizePurchasePaymentMethod(paymentMethod);

  let resolvedUserId = String(userId || '').trim() || null;
  if (!resolvedUserId) {
    try {
      const session = await getCurrentSession();
      resolvedUserId = session?.user?.id || null;
    } catch {
      resolvedUserId = null;
    }
  }

  const mutationId = String(idempotencyKey || '').trim()
    || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const nowIso = new Date().toISOString();
  const queued = await enqueueOutboxMutation({
    businessId,
    mutationType: 'purchase.create',
    payload: {
      local_write: true,
      user_id: resolvedUserId,
      supplier_id: supplierId || null,
      payment_method: normalizedPaymentMethod,
      notes: notes || null,
      total: normalizedTotal,
      items_count: normalizedItems.length,
      items: normalizedItems,
      created_at: nowIso,
      idempotency_key: mutationId
    },
    mutationId
  });

  if (!queued) {
    return {
      success: false,
      error: 'No se pudo guardar la compra localmente. Intenta de nuevo.'
    };
  }

  return {
    success: true,
    localOnly: true,
    pendingSync: true,
    data: {
      id: buildLocalPurchaseId(mutationId),
      total: normalizedTotal,
      items_count: normalizedItems.length,
      payment_method: normalizedPaymentMethod,
      created_at: nowIso
    }
  };
}

function isMissingCreatePurchaseRpcError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'PGRST202'
    || code === '42883'
    || message.includes('create_purchase_complete')
  );
}

async function createPurchaseLegacy({
  businessId,
  userId,
  supplierId,
  paymentMethod,
  notes,
  total,
  cart
}) {
  const { data: purchase, error: purchaseError } = await supabaseAdapter.insertPurchase({
    business_id: businessId,
    user_id: userId,
    supplier_id: supplierId,
    payment_method: paymentMethod,
    notes: notes || null,
    total,
    created_at: new Date().toISOString()
  });

  if (purchaseError) throw purchaseError;

  const purchaseDetails = cart.map((item) => ({
    purchase_id: purchase.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_cost: item.unit_price,
    subtotal: item.quantity * item.unit_price
  }));

  const { error: detailsError } = await supabaseAdapter.insertPurchaseDetails(purchaseDetails);
  if (detailsError) {
    await supabaseAdapter.deletePurchaseById(purchase.id);
    throw detailsError;
  }

  const productIds = [...new Set(cart.map((item) => item.product_id))];
  const { data: freshProducts, error: productsFetchError } = await supabaseAdapter.getProductsByBusinessAndIds(
    businessId,
    productIds
  );
  if (productsFetchError) throw productsFetchError;

  const stockMap = new Map((freshProducts || []).map((product) => [
    product.id,
    {
      stock: Number(product.stock || 0),
      manage_stock: product.manage_stock !== false
    }
  ]));
  const purchaseItemMap = new Map(cart.map((item) => [item.product_id, item]));

  const updateResults = await Promise.all(
    productIds.map((productId) => {
      const item = purchaseItemMap.get(productId);
      const productState = stockMap.get(productId) || { stock: 0, manage_stock: true };
      const currentStock = Number(productState.stock || 0);
      const shouldManageStock = productState.manage_stock !== false;
      const newStock = shouldManageStock
        ? currentStock + Number(item.quantity || 0)
        : currentStock;

      return supabaseAdapter.updateProductStockAndPurchasePrice({
        businessId,
        productId,
        stock: newStock,
        purchasePrice: Number(item.unit_price || 0)
      });
    })
  );

  const failedUpdate = updateResults.find((result) => result.error);
  if (failedUpdate?.error) throw failedUpdate.error;

  return {
    purchaseId: purchase.id
  };
}

export async function createPurchaseWithRpcFallback({
  businessId,
  userId,
  supplierId,
  paymentMethod,
  notes,
  total,
  cart,
  idempotencyKey = null
}) {
  await assertPurchasableProductsManageStock({ businessId, cart });

  const forceLocalFirst = shouldForcePurchasesLocalFirst();
  if (forceLocalFirst) {
    const queuedResult = await enqueueOfflinePurchaseMutation({
      businessId,
      userId,
      supplierId,
      paymentMethod,
      notes,
      total,
      cart,
      idempotencyKey
    });

    if (queuedResult?.success && typeof navigator !== 'undefined' && navigator.onLine) {
      runOutboxTick().catch(() => {});
    }

    return queuedResult;
  }

  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode && canQueueLocalPurchases()) {
    return enqueueOfflinePurchaseMutation({
      businessId,
      userId,
      supplierId,
      paymentMethod,
      notes,
      total,
      cart,
      idempotencyKey
    });
  }

  const purchaseItemsPayload = cart.map((item) => ({
    product_id: item.product_id,
    quantity: Number(item.quantity),
    unit_cost: Number(item.unit_price)
  }));
  const normalizedPaymentMethod = normalizePurchasePaymentMethod(paymentMethod);

  let rpcData = null;
  let rpcError = null;
  ({ data: rpcData, error: rpcError } = await supabaseAdapter.createPurchaseCompleteRpc({
    p_business_id: businessId,
    p_user_id: userId,
    p_supplier_id: supplierId,
    p_payment_method: normalizedPaymentMethod,
    p_notes: notes || null,
    p_items: purchaseItemsPayload
  }));

  let purchaseId = null;
  if (rpcError) {
    if (canQueueLocalPurchases() && isConnectivityError(rpcError)) {
      return enqueueOfflinePurchaseMutation({
        businessId,
        userId,
        supplierId,
        paymentMethod: normalizedPaymentMethod,
        notes,
        total,
        cart,
        idempotencyKey
      });
    }

    if (!isMissingCreatePurchaseRpcError(rpcError)) {
      throw rpcError;
    }

    const legacyResult = await createPurchaseLegacy({
      businessId,
      userId,
      supplierId,
      paymentMethod: normalizedPaymentMethod,
      notes,
      total,
      cart
    });

    purchaseId = legacyResult?.purchaseId || null;
  } else {
    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    purchaseId = rpcRow?.purchase_id || null;
  }

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'purchase.create',
    payload: {
      purchase_id: purchaseId,
      supplier_id: supplierId,
      payment_method: normalizedPaymentMethod,
      total,
      items_count: cart.length
    },
    mutationId: idempotencyKey || `${businessId}:${userId}:${Date.now()}:purchase.create`
  });

  return {
    success: true,
    localOnly: false,
    data: {
      id: purchaseId,
      total: Number(total || 0),
      items_count: Number(cart?.length || 0),
      payment_method: normalizedPaymentMethod
    }
  };
}

export async function deletePurchaseWithStockFallback({ purchaseId, businessId }) {
  const { data: purchaseDetails, error: detailsFetchError } = await supabaseAdapter.getPurchaseDetailsByPurchaseId(
    purchaseId
  );
  if (detailsFetchError) throw new Error(`Error al consultar detalles: ${detailsFetchError.message}`);

  const groupedDetailsMap = new Map();
  (purchaseDetails || []).forEach((detail) => {
    const productId = detail.product_id;
    const quantity = Number(detail.quantity || 0);
    if (!productId || quantity <= 0) return;
    groupedDetailsMap.set(productId, (groupedDetailsMap.get(productId) || 0) + quantity);
  });

  const groupedDetails = Array.from(groupedDetailsMap.entries()).map(([product_id, quantity]) => ({
    product_id,
    quantity
  }));

  const productIds = groupedDetails.map((item) => item.product_id);
  let stockBeforeMap = new Map();

  if (productIds.length > 0) {
    const { data: productsBefore, error: productsBeforeError } = await supabaseAdapter.getProductsByBusinessAndIds(
      businessId,
      productIds
    );
    if (productsBeforeError) throw new Error(`Error al consultar stock previo: ${productsBeforeError.message}`);
    stockBeforeMap = new Map((productsBefore || []).map((p) => [
      p.id,
      {
        stock: Number(p.stock || 0),
        manage_stock: p.manage_stock !== false
      }
    ]));
  }

  const { error: deleteDetailsError } = await supabaseAdapter.deletePurchaseDetailsByPurchaseId(purchaseId);
  if (deleteDetailsError) throw new Error(`Error al eliminar detalles: ${deleteDetailsError.message}`);

  const { error: deleteError } = await supabaseAdapter.deletePurchaseById(purchaseId);
  if (deleteError) throw new Error(`Error al eliminar compra: ${deleteError.message}`);

  let appliedManualFallback = false;

  if (productIds.length > 0) {
    const { data: productsAfter, error: productsAfterError } = await supabaseAdapter.getProductsByBusinessAndIds(
      businessId,
      productIds
    );
    if (productsAfterError) throw new Error(`Error al consultar stock posterior: ${productsAfterError.message}`);

    const stockAfterMap = new Map((productsAfter || []).map((p) => [
      p.id,
      {
        stock: Number(p.stock || 0),
        manage_stock: p.manage_stock !== false
      }
    ]));
    const managedDetails = groupedDetails.filter((item) => {
      const before = stockBeforeMap.get(item.product_id);
      return before?.manage_stock !== false;
    });
    const noStockChanged = managedDetails.every((item) => {
      const before = stockBeforeMap.get(item.product_id)?.stock;
      const after = stockAfterMap.get(item.product_id)?.stock;
      return Number.isFinite(before) && Number.isFinite(after) && before === after;
    });

    if (noStockChanged) {
      const fallbackUpdates = managedDetails.map((item) => {
        const currentStock = stockAfterMap.get(item.product_id)?.stock;
        if (!Number.isFinite(currentStock)) {
          return Promise.resolve({ error: new Error(`Stock no disponible para ${item.product_id}`) });
        }

        return supabaseAdapter.updateProductStockAndPurchasePrice({
          businessId,
          productId: item.product_id,
          stock: currentStock - item.quantity,
          purchasePrice: undefined
        });
      });

      const fallbackResults = await Promise.all(fallbackUpdates);
      const fallbackError = fallbackResults.find((result) => result.error)?.error;
      if (fallbackError) throw new Error(`Error al ajustar stock manualmente: ${fallbackError.message}`);

      appliedManualFallback = true;
    }
  }

  await enqueueOutboxMutation({
    businessId,
    mutationType: 'purchase.delete',
    payload: {
      purchase_id: purchaseId,
      products_affected: productIds.length
    },
    mutationId: `${businessId}:${purchaseId}:purchase.delete`
  });

  return { appliedManualFallback };
}
