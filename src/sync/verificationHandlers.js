import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';

function normalizeText(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIdArray(values = []) {
  return [...new Set((values || []).map((value) => normalizeText(value)).filter(Boolean))];
}

function isAdminRoleLike(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return normalizedRole === 'owner'
    || normalizedRole === 'admin'
    || normalizedRole === 'administrador'
    || normalizedRole === 'propietario'
    || normalizedRole.includes('admin');
}

const GENERIC_SELLER_LABELS = new Set([
  'empleado',
  'employee',
  'vendedor',
  'seller',
  'usuario',
  'user',
  'vendedor desconocido'
]);

function isEmailLike(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function isGenericSellerLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  if (GENERIC_SELLER_LABELS.has(normalized)) return true;
  return isEmailLike(normalized);
}

function sanitizeSellerFallback(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (!isEmailLike(normalized)) return normalized;

  const localPart = normalizeText(normalized.split('@')[0]);
  if (!localPart) return null;

  const normalizedLocalPart = localPart
    .replace(/[._-]+/g, ' ')
    .trim()
    .toLowerCase();
  if (!normalizedLocalPart || GENERIC_SELLER_LABELS.has(normalizedLocalPart)) {
    return null;
  }

  return normalizedLocalPart;
}

async function resolveSellerNameForSaleSync({
  businessId,
  userId,
  payloadSellerName,
  fallbackEmail = null
}) {
  const normalizedPayloadName = normalizeText(payloadSellerName);
  const normalizedPayloadLabel = String(normalizedPayloadName || '').trim().toLowerCase();
  const payloadLooksAdmin = normalizedPayloadLabel === 'administrador' || normalizedPayloadLabel === 'admin';
  const payloadLooksGeneric = isGenericSellerLabel(normalizedPayloadName);
  const shouldRecompute = !normalizedPayloadName || payloadLooksAdmin || payloadLooksGeneric;

  if (!shouldRecompute) {
    return normalizedPayloadName;
  }

  try {
    const [{ data: employee }, { data: business }] = await Promise.all([
      supabaseAdapter.getEmployeeByUserAndBusiness(userId, businessId, 'full_name, role'),
      supabaseAdapter.getBusinessById(businessId, 'created_by')
    ]);

    const normalizedBusinessOwnerId = normalizeText(business?.created_by);
    const isOwner = Boolean(normalizedBusinessOwnerId && normalizedBusinessOwnerId === userId);
    const isAdmin = isAdminRoleLike(employee?.role);

    if (isOwner || isAdmin) {
      return 'Administrador';
    }

    const employeeName = normalizeText(employee?.full_name);
    if (employeeName) return employeeName;
  } catch {
    // no-op
  }

  if (payloadLooksAdmin) return 'Administrador';

  return (
    sanitizeSellerFallback(normalizedPayloadName)
    || sanitizeSellerFallback(fallbackEmail)
    || 'Empleado'
  );
}

function ackPayload(event, mode = 'verify', details = {}) {
  return {
    mode,
    mutation_type: event?.mutation_type || null,
    verified_at: new Date().toISOString(),
    ...details
  };
}

function verifySkip(event, reason, details = {}) {
  return {
    ok: true,
    ackPayload: ackPayload(event, 'verify-skip', {
      reason,
      ...details
    })
  };
}

function reject(error, details = null) {
  return {
    ok: false,
    error,
    details
  };
}

function rejectRetryable(error, details = null) {
  return {
    ok: false,
    error,
    details,
    retryable: true
  };
}

function isRetriableSyncError(errorLike) {
  const status = Number(errorLike?.status || errorLike?.statusCode || 0);
  const code = String(errorLike?.code || '').toLowerCase();
  const message = String(errorLike?.message || errorLike || '').toLowerCase();

  if (status >= 500 || status === 429 || status === 408) return true;
  if (code === '57014' || code === 'pgrst301') return true;

  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('load failed')
    || message.includes('timeout')
    || message.includes('temporarily unavailable')
    || message.includes('service unavailable')
    || message.includes('gateway')
    || message.includes('too many requests')
  );
}

function hasNumericMismatch(expectedValue, actualValue, tolerance = 0.01) {
  const expected = normalizeNumber(expectedValue);
  const actual = normalizeNumber(actualValue);
  if (expected === null || actual === null) return false;
  return Math.abs(expected - actual) > tolerance;
}

function isFunctionUnavailableError(errorLike, functionName) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;

  const normalizedFn = String(functionName || '').toLowerCase();
  const referencesFunction = normalizedFn ? message.includes(normalizedFn) : true;

  return referencesFunction && (
    message.includes('does not exist')
    || message.includes('could not find the function')
    || message.includes('schema cache')
    || message.includes('not found')
    || message.includes('pgrst202')
  );
}

function isOrderContextError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;

  return (
    message.includes('la orden') && message.includes('no está abierta')
  ) || (
    message.includes('la mesa') && message.includes('no está asociada')
  ) || (
    message.includes('cambió durante el cierre')
  ) || (
    message.includes('orden') && message.includes('no encontrada')
  ) || (
    message.includes('mesa') && message.includes('no encontrada')
  ) || (
    message.includes('order') && message.includes('not found')
  ) || (
    message.includes('table') && message.includes('not found')
  ) || (
    message.includes('invalid input syntax for type uuid')
  );
}

function isNotFoundLikeError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  const status = Number(errorLike?.status || errorLike?.statusCode || 0);
  return (
    status === 404
    || message.includes('not found')
    || message.includes('no rows')
    || message.includes('0 rows')
    || message.includes('does not exist')
  );
}

function normalizeOutboxSaleCreateItems(items = []) {
  const sourceItems = Array.isArray(items) ? items : [];
  return sourceItems.map((item = {}) => {
    const productId = normalizeText(item?.product_id);
    const comboId = normalizeText(item?.combo_id);
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.unit_price);

    if ((!productId && !comboId) || (productId && comboId)) {
      throw new Error('Item inválido en outbox sale.create');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Cantidad inválida en outbox sale.create');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('Precio inválido en outbox sale.create');
    }

    return {
      product_id: productId,
      combo_id: comboId,
      quantity,
      unit_price: unitPrice
    };
  });
}

function normalizeOutboxPurchaseCreateItems(items = []) {
  const sourceItems = Array.isArray(items) ? items : [];
  return sourceItems.map((item = {}) => {
    const productId = normalizeText(item?.product_id);
    const quantity = Number(item?.quantity);
    const unitCost = Number(item?.unit_cost ?? item?.unit_price);

    if (!productId) {
      throw new Error('Item inválido en outbox purchase.create');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Cantidad inválida en outbox purchase.create');
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new Error('Costo inválido en outbox purchase.create');
    }

    return {
      product_id: productId,
      quantity,
      unit_cost: unitCost
    };
  });
}

function isMissingCreatePurchaseRpcError(errorLike) {
  const code = String(errorLike?.code || '');
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    code === 'PGRST202'
    || code === '42883'
    || message.includes('create_purchase_complete')
  );
}

function normalizePurchasePaymentMethod(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'cash';
  if (normalized === 'efectivo') return 'cash';
  if (normalized === 'tarjeta') return 'card';
  if (normalized === 'transferencia') return 'transfer';
  return normalized;
}

async function createPurchaseLegacyFromOutbox({
  businessId,
  userId,
  supplierId,
  paymentMethod,
  notes,
  total,
  items
}) {
  const { data: purchase, error: purchaseError } = await supabaseAdapter.insertPurchase({
    business_id: businessId,
    user_id: userId,
    supplier_id: supplierId,
    payment_method: paymentMethod,
    notes: notes || null,
    total: Number(total || 0),
    created_at: new Date().toISOString()
  });
  if (purchaseError) throw purchaseError;

  const purchaseDetailsRows = items.map((item) => ({
    purchase_id: purchase.id,
    product_id: item.product_id,
    quantity: Number(item.quantity || 0),
    unit_cost: Number(item.unit_cost || 0),
    subtotal: Number(item.quantity || 0) * Number(item.unit_cost || 0)
  }));

  const { error: detailsError } = await supabaseAdapter.insertPurchaseDetails(purchaseDetailsRows);
  if (detailsError) {
    await supabaseAdapter.deletePurchaseById(purchase.id);
    throw detailsError;
  }

  const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))];
  if (productIds.length > 0) {
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

    const purchaseItemMap = new Map(items.map((item) => [item.product_id, item]));
    const updateResults = await Promise.all(
      productIds.map((productId) => {
        const purchaseItem = purchaseItemMap.get(productId);
        const productState = stockMap.get(productId) || { stock: 0, manage_stock: true };
        const currentStock = Number(productState.stock || 0);
        const shouldManageStock = productState.manage_stock !== false;
        const newStock = shouldManageStock
          ? currentStock + Number(purchaseItem?.quantity || 0)
          : currentStock;

        return supabaseAdapter.updateProductStockAndPurchasePrice({
          businessId,
          productId,
          stock: newStock,
          purchasePrice: Number(purchaseItem?.unit_cost || 0)
        });
      })
    );
    const failedUpdate = updateResults.find((result) => result?.error);
    if (failedUpdate?.error) throw failedUpdate.error;
  }

  return {
    purchaseId: purchase.id
  };
}

async function pushPurchaseCreateToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id);
  if (!businessId) {
    return reject('Mutación purchase.create sin business_id', {
      business_id: businessId
    });
  }

  let itemsForRpc = [];
  try {
    itemsForRpc = normalizeOutboxPurchaseCreateItems(payload?.items || []);
  } catch (error) {
    return reject(error?.message || 'Items inválidos en outbox purchase.create');
  }

  if (itemsForRpc.length === 0) {
    return reject('Mutación purchase.create sin items para sincronizar', {
      business_id: businessId
    });
  }

  let userId = normalizeText(payload?.user_id);
  if (!userId) {
    const { data, error } = await supabaseAdapter.getCurrentSession();
    if (error) {
      return reject('No se pudo resolver sesión para sincronizar compra offline', {
        business_id: businessId,
        reason: error?.message || String(error)
      });
    }
    userId = normalizeText(data?.session?.user?.id);
  }

  if (!userId) {
    return reject('No se pudo resolver usuario para sincronizar compra offline', {
      business_id: businessId
    });
  }

  const supplierId = normalizeText(payload?.supplier_id);
  const paymentMethod = normalizePurchasePaymentMethod(payload?.payment_method);
  const notes = normalizeText(payload?.notes);
  const totalFromPayload = normalizeNumber(payload?.total);
  const computedTotal = itemsForRpc.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)),
    0
  );
  const total = totalFromPayload !== null ? totalFromPayload : computedTotal;

  let rpcData = null;
  let rpcError = null;
  ({ data: rpcData, error: rpcError } = await supabaseAdapter.createPurchaseCompleteRpc({
    p_business_id: businessId,
    p_user_id: userId,
    p_supplier_id: supplierId,
    p_payment_method: paymentMethod,
    p_notes: notes,
    p_items: itemsForRpc
  }));

  let remotePurchaseId = null;
  if (rpcError) {
    if (!isMissingCreatePurchaseRpcError(rpcError)) {
      return reject('No se pudo sincronizar compra offline en remoto', {
        business_id: businessId,
        error: rpcError?.message || String(rpcError)
      });
    }

    try {
      const legacy = await createPurchaseLegacyFromOutbox({
        businessId,
        userId,
        supplierId,
        paymentMethod,
        notes,
        total,
        items: itemsForRpc
      });
      remotePurchaseId = normalizeText(legacy?.purchaseId);
    } catch (legacyError) {
      return reject('No se pudo sincronizar compra offline en remoto', {
        business_id: businessId,
        error: legacyError?.message || String(legacyError)
      });
    }
  } else {
    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    remotePurchaseId = normalizeText(rpcRow?.purchase_id);
  }

  if (!remotePurchaseId) {
    return reject('Sincronización de compra offline sin purchase_id remoto', {
      business_id: businessId
    });
  }

  return {
    ok: true,
    businessId,
    purchaseId: remotePurchaseId
  };
}

async function pushSaleCreateToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id);
  if (!businessId) {
    return reject('Mutación sale.create sin business_id', {
      business_id: businessId
    });
  }

  let itemsForRpc = [];
  try {
    itemsForRpc = normalizeOutboxSaleCreateItems(payload?.items || []);
  } catch (error) {
    return reject(error?.message || 'Items inválidos en outbox sale.create');
  }

  if (itemsForRpc.length === 0) {
    return reject('Mutación sale.create sin items para sincronizar', {
      business_id: businessId
    });
  }

  let userId = normalizeText(payload?.user_id);
  let sessionUserEmail = null;
  if (!userId) {
    const { data, error } = await supabaseAdapter.getCurrentSession();
    if (error) {
      if (isRetriableSyncError(error)) {
        throw new Error(`SYNC_RETRYABLE_SESSION: ${error?.message || String(error)}`);
      }
      return reject('No se pudo resolver sesión para sincronizar venta offline', {
        business_id: businessId,
        reason: error?.message || String(error)
      });
    }
    userId = normalizeText(data?.session?.user?.id);
    sessionUserEmail = normalizeText(data?.session?.user?.email);
  }

  if (!userId) {
    return reject('No se pudo resolver usuario para sincronizar venta offline', {
      business_id: businessId
    });
  }

  const paymentMethod = normalizeText(payload?.payment_method) || 'cash';
  const sellerName = await resolveSellerNameForSaleSync({
    businessId,
    userId,
    payloadSellerName: payload?.seller_name,
    fallbackEmail: sessionUserEmail
  });
  const orderId = normalizeText(payload?.order_id);
  const tableId = normalizeText(payload?.table_id);
  const amountReceived = normalizeNumber(payload?.amount_received);
  const changeBreakdown = Array.isArray(payload?.change_breakdown) ? payload.change_breakdown : [];
  const idempotencyKey = normalizeText(payload?.idempotency_key)
    || normalizeText(event?.mutation_id)
    || `${businessId}:${event?.id || Date.now()}:sale.create.sync`;

  let rpcData = null;
  let rpcError = null;
  const buildIdempotentPayload = ({ includeOrderContext = true } = {}) => ({
    p_business_id: businessId,
    p_user_id: userId,
    p_seller_name: sellerName,
    p_payment_method: paymentMethod,
    p_items: itemsForRpc,
    p_order_id: includeOrderContext ? orderId : null,
    p_table_id: includeOrderContext ? tableId : null,
    p_amount_received: paymentMethod === 'cash' && Number.isFinite(amountReceived) ? amountReceived : null,
    p_change_breakdown: paymentMethod === 'cash' ? changeBreakdown : [],
    p_idempotency_key: idempotencyKey
  });

  const buildBasePayload = ({ includeOrderContext = true } = {}) => ({
    p_business_id: businessId,
    p_user_id: userId,
    p_seller_name: sellerName,
    p_payment_method: paymentMethod,
    p_items: itemsForRpc,
    p_order_id: includeOrderContext ? orderId : null,
    p_table_id: includeOrderContext ? tableId : null,
    p_amount_received: paymentMethod === 'cash' && Number.isFinite(amountReceived) ? amountReceived : null,
    p_change_breakdown: paymentMethod === 'cash' ? changeBreakdown : []
  });

  ({ data: rpcData, error: rpcError } = await supabaseAdapter.createSaleCompleteIdempotentRpc(
    buildIdempotentPayload({ includeOrderContext: true })
  ));

  const missingIdempotentFn = isFunctionUnavailableError(
    rpcError,
    'create_sale_complete_idempotent'
  );

  if (rpcError && missingIdempotentFn) {
    ({ data: rpcData, error: rpcError } = await supabaseAdapter.createSaleCompleteRpc(
      buildBasePayload({ includeOrderContext: true })
    ));
  }

  const hasOrderContext = Boolean(orderId || tableId);
  const shouldRetryWithoutOrderContext = Boolean(
    rpcError
    && hasOrderContext
    && isOrderContextError(rpcError)
  );

  if (shouldRetryWithoutOrderContext) {
    ({ data: rpcData, error: rpcError } = await supabaseAdapter.createSaleCompleteIdempotentRpc(
      buildIdempotentPayload({ includeOrderContext: false })
    ));

    const missingIdempotentFnNoContext = isFunctionUnavailableError(
      rpcError,
      'create_sale_complete_idempotent'
    );
    if (rpcError && missingIdempotentFnNoContext) {
      ({ data: rpcData, error: rpcError } = await supabaseAdapter.createSaleCompleteRpc(
        buildBasePayload({ includeOrderContext: false })
      ));
    }
  }

  if (rpcError) {
    if (isRetriableSyncError(rpcError)) {
      throw new Error(`SYNC_RETRYABLE_SALE_CREATE: ${rpcError?.message || String(rpcError)}`);
    }
    return reject('No se pudo sincronizar venta offline en remoto', {
      business_id: businessId,
      error: rpcError?.message || String(rpcError)
    });
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : null;
  if (!row || row?.status !== 'success') {
    return reject('Respuesta inválida al sincronizar venta offline', {
      business_id: businessId
    });
  }

  const remoteSaleId = normalizeText(row?.sale_id);
  if (!remoteSaleId) {
    return reject('Sincronización de venta offline sin sale_id remoto', {
      business_id: businessId
    });
  }

  // Garantizar consistencia fuerte: después de sincronizar la venta, la orden debe
  // quedar cerrada y la mesa sin puntero activo.
  if (hasOrderContext) {
    const ensureReleaseResult = await ensureReleasedOrderAndTableAfterSale({
      businessId,
      orderId,
      tableId,
      saleId: remoteSaleId
    });
    if (!ensureReleaseResult?.ok) return ensureReleaseResult;
  }

  return {
    ok: true,
    businessId,
    saleId: remoteSaleId
  };
}

async function getSaleState({ businessId, saleId }) {
  const { data, error } = await supabaseAdapter.getSaleSyncStateById({
    saleId,
    businessId
  });
  if (error) throw error;
  return data || null;
}

async function getSalesStateByIds({ businessId, saleIds = [] }) {
  const ids = normalizeIdArray(saleIds);
  if (ids.length === 0) return [];

  const { data, error } = await supabaseAdapter.getSalesSyncStateByIds({
    saleIds: ids,
    businessId
  });
  if (error) throw error;
  return data || [];
}

async function getPurchaseState({ businessId, purchaseId }) {
  const { data, error } = await supabaseAdapter.getPurchaseSyncStateById({
    purchaseId,
    businessId
  });
  if (error) throw error;
  return data || null;
}

async function getOrderState({ businessId, orderId }) {
  const { data, error } = await supabaseAdapter.getOrderSyncStateById({
    orderId,
    businessId
  });
  if (error) throw error;
  return data || null;
}

async function getTableState({ businessId, tableId }) {
  const { data, error } = await supabaseAdapter.getTableSyncStateById({
    tableId,
    businessId
  });
  if (error) throw error;
  return data || null;
}

async function ensureReleasedOrderAndTableAfterSale({
  businessId,
  orderId = null,
  tableId = null,
  saleId = null
}) {
  const normalizedBusinessId = normalizeText(businessId);
  const normalizedOrderId = normalizeText(orderId);
  const normalizedTableId = normalizeText(tableId);
  const normalizedSaleId = normalizeText(saleId);

  if (!normalizedBusinessId) {
    return reject('No se pudo validar liberación de mesa: business_id inválido', {
      business_id: normalizedBusinessId,
      order_id: normalizedOrderId,
      table_id: normalizedTableId,
      sale_id: normalizedSaleId
    });
  }

  if (!normalizedOrderId && !normalizedTableId) {
    return { ok: true };
  }

  if (normalizedOrderId) {
    const orderState = await getOrderState({
      businessId: normalizedBusinessId,
      orderId: normalizedOrderId
    });

    const currentOrderStatus = normalizeText(orderState?.status);
    if (orderState && currentOrderStatus !== 'closed') {
      const { error: closeOrderError } = await supabaseAdapter.updateOrderByBusinessAndId({
        businessId: normalizedBusinessId,
        orderId: normalizedOrderId,
        payload: {
          status: 'closed',
          closed_at: new Date().toISOString()
        }
      });

      if (closeOrderError && !isNotFoundLikeError(closeOrderError)) {
        if (isRetriableSyncError(closeOrderError)) {
          throw new Error(`SYNC_RETRYABLE_CLOSE_ORDER_AFTER_SALE: ${closeOrderError?.message || String(closeOrderError)}`);
        }
        return reject('Venta sincronizada, pero no se pudo cerrar la orden asociada', {
          business_id: normalizedBusinessId,
          order_id: normalizedOrderId,
          sale_id: normalizedSaleId,
          error: closeOrderError?.message || String(closeOrderError)
        });
      }

      const refreshedOrder = await getOrderState({
        businessId: normalizedBusinessId,
        orderId: normalizedOrderId
      });
      const refreshedStatus = normalizeText(refreshedOrder?.status);
      if (refreshedOrder && refreshedStatus !== 'closed') {
        return rejectRetryable('La orden sigue abierta tras sincronizar la venta', {
          business_id: normalizedBusinessId,
          order_id: normalizedOrderId,
          sale_id: normalizedSaleId,
          current_status: refreshedStatus
        });
      }
    }
  }

  if (normalizedTableId) {
    const tableState = await getTableState({
      businessId: normalizedBusinessId,
      tableId: normalizedTableId
    });

    const currentOrderId = normalizeText(tableState?.current_order_id);
    const currentStatus = normalizeText(tableState?.status);
    const tableNeedsRelease = Boolean(currentOrderId) || currentStatus === 'occupied' || currentStatus === 'open';

    if (tableState && tableNeedsRelease) {
      const { error: releaseTableError } = await supabaseAdapter.updateTableByBusinessAndId({
        businessId: normalizedBusinessId,
        tableId: normalizedTableId,
        payload: {
          current_order_id: null,
          status: 'available'
        }
      });

      if (
        releaseTableError
        && !isMissingTablesUpdatedAtColumnError(releaseTableError)
        && !isNotFoundLikeError(releaseTableError)
      ) {
        if (isRetriableSyncError(releaseTableError)) {
          throw new Error(`SYNC_RETRYABLE_RELEASE_TABLE_AFTER_SALE: ${releaseTableError?.message || String(releaseTableError)}`);
        }
        return reject('Venta sincronizada, pero no se pudo liberar la mesa asociada', {
          business_id: normalizedBusinessId,
          table_id: normalizedTableId,
          sale_id: normalizedSaleId,
          error: releaseTableError?.message || String(releaseTableError)
        });
      }

      const refreshedTable = await getTableState({
        businessId: normalizedBusinessId,
        tableId: normalizedTableId
      });
      const refreshedOrderId = normalizeText(refreshedTable?.current_order_id);
      const refreshedStatus = normalizeText(refreshedTable?.status);

      if (refreshedTable && (refreshedOrderId || (refreshedStatus && refreshedStatus !== 'available'))) {
        return rejectRetryable('La mesa sigue con datos de orden tras sincronizar la venta', {
          business_id: normalizedBusinessId,
          table_id: normalizedTableId,
          sale_id: normalizedSaleId,
          current_order_id: refreshedOrderId,
          current_status: refreshedStatus
        });
      }
    }
  }

  return { ok: true };
}

async function getOrderItemState(itemId) {
  const { data, error } = await supabaseAdapter.getOrderItemSyncStateById(itemId);
  if (error) throw error;
  return data || null;
}

async function getOrderItemStateByOrderAndReference({ orderId, productId = null, comboId = null }) {
  if (!orderId || (!productId && !comboId)) return null;
  const selectSql = 'id, order_id, product_id, combo_id, quantity, price';
  const { data, error } = await supabaseAdapter.getOrderItemByOrderAndReference({
    orderId,
    productId,
    comboId,
    selectSql
  });
  if (!error) return data || null;

  const message = String(error?.message || error || '').toLowerCase();
  const shouldFallback = (
    message.includes('created_at')
    || message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('pgrst')
  );
  if (!shouldFallback) throw error;

  const { data: rows, error: fallbackError } = await supabaseAdapter.getOrderItemsByOrderId(orderId, selectSql);
  if (fallbackError) throw fallbackError;

  const list = Array.isArray(rows) ? rows : [];
  const byRef = list.filter((row) => {
    const rowProductId = normalizeText(row?.product_id);
    const rowComboId = normalizeText(row?.combo_id);
    if (productId) return rowProductId === productId && !rowComboId;
    if (comboId) return rowComboId === comboId && !rowProductId;
    return false;
  });
  return byRef.length > 0 ? byRef[byRef.length - 1] : null;
}

async function getOrderItemsStateByIds(itemIds = []) {
  const ids = normalizeIdArray(itemIds);
  if (ids.length === 0) return [];

  const { data, error } = await supabaseAdapter.getOrderItemsSyncStateByIds(ids);
  if (error) throw error;
  return data || [];
}

async function getOrdersByTableId({ businessId, tableId }) {
  const { data, error } = await supabaseAdapter.getOrdersByTableId({
    tableId,
    businessId
  });
  if (error) throw error;
  return data || [];
}

async function getProductState({ businessId, productId }) {
  const { data, error } = await supabaseAdapter.getProductSyncStateById({
    businessId,
    productId
  });
  if (error) throw error;
  return data || null;
}

async function getSupplierState({ businessId, supplierId }) {
  const { data, error } = await supabaseAdapter.getSupplierSyncStateById({
    businessId,
    supplierId
  });
  if (error) throw error;
  return data || null;
}

async function getInvoiceState({ businessId, invoiceId }) {
  const { data, error } = await supabaseAdapter.getInvoiceSyncStateById({
    businessId,
    invoiceId
  });
  if (error) throw error;
  return data || null;
}

async function verifySaleCreate(event) {
  let businessId = normalizeText(event?.business_id);
  let saleId = normalizeText(event?.payload?.sale_id);
  let verifyMode = 'verify';

  if (!saleId) {
    const pushResult = await pushSaleCreateToRemote(event);
    if (!pushResult?.ok) return pushResult;
    businessId = pushResult.businessId;
    saleId = pushResult.saleId;
    verifyMode = 'push-verify';
  }

  if (!businessId || !saleId) {
    return reject('Mutación sale.create sin identificadores válidos', {
      business_id: businessId,
      sale_id: saleId
    });
  }

  const state = await getSaleState({ businessId, saleId });
  if (!state) {
    return reject('Venta no visible en remoto tras create', {
      sale_id: saleId,
      business_id: businessId
    });
  }

  const expectedPaymentMethod = normalizeText(event?.payload?.payment_method);
  const remotePaymentMethod = normalizeText(state.payment_method);
  if (expectedPaymentMethod && remotePaymentMethod && expectedPaymentMethod !== remotePaymentMethod) {
    return reject('Método de pago de venta no coincide en remoto', {
      sale_id: saleId,
      expected_payment_method: expectedPaymentMethod,
      current_payment_method: remotePaymentMethod
    });
  }

  if (hasNumericMismatch(event?.payload?.total, state.total)) {
    return reject('Total de venta no coincide en remoto', {
      sale_id: saleId,
      expected_total: normalizeNumber(event?.payload?.total),
      current_total: normalizeNumber(state.total)
    });
  }

  const contextOrderId = normalizeText(event?.payload?.order_id);
  const contextTableId = normalizeText(event?.payload?.table_id);
  if (contextOrderId || contextTableId) {
    const ensureReleaseResult = await ensureReleasedOrderAndTableAfterSale({
      businessId,
      orderId: contextOrderId,
      tableId: contextTableId,
      saleId
    });
    if (!ensureReleaseResult?.ok) return ensureReleaseResult;
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      sale_id: state.id,
      total: normalizeNumber(state.total),
      payment_method: remotePaymentMethod,
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

async function verifySaleDelete(event) {
  const businessId = normalizeText(event?.business_id);
  const saleId = normalizeText(event?.payload?.sale_id);

  if (!businessId || !saleId) {
    return reject('Mutación sale.delete sin identificadores', {
      business_id: businessId,
      sale_id: saleId
    });
  }

  const state = await getSaleState({ businessId, saleId });
  if (state) {
    return reject('Venta sigue presente en remoto tras delete', {
      sale_id: saleId,
      business_id: businessId
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'verify', {
      sale_id: saleId,
      deleted_remote: true
    })
  };
}

async function verifyPurchaseCreate(event) {
  let businessId = normalizeText(event?.business_id);
  let purchaseId = normalizeText(event?.payload?.purchase_id);
  let verifyMode = 'verify';

  if (!purchaseId) {
    const pushResult = await pushPurchaseCreateToRemote(event);
    if (!pushResult?.ok) return pushResult;
    businessId = pushResult.businessId;
    purchaseId = pushResult.purchaseId;
    verifyMode = 'push-verify';
  }

  if (!businessId || !purchaseId) {
    return reject('Mutación purchase.create sin identificadores válidos', {
      business_id: businessId,
      purchase_id: purchaseId
    });
  }

  const state = await getPurchaseState({ businessId, purchaseId });
  if (!state) {
    return reject('Compra no visible en remoto tras create', {
      business_id: businessId,
      purchase_id: purchaseId
    });
  }

  if (hasNumericMismatch(event?.payload?.total, state.total)) {
    return reject('Total de compra no coincide en remoto', {
      purchase_id: purchaseId,
      expected_total: normalizeNumber(event?.payload?.total),
      current_total: normalizeNumber(state.total)
    });
  }

  const expectedPaymentMethod = normalizePurchasePaymentMethod(event?.payload?.payment_method);
  const remotePaymentMethod = normalizePurchasePaymentMethod(state.payment_method);
  if (expectedPaymentMethod && remotePaymentMethod && expectedPaymentMethod !== remotePaymentMethod) {
    return reject('Método de pago de compra no coincide en remoto', {
      purchase_id: purchaseId,
      expected_payment_method: expectedPaymentMethod,
      current_payment_method: remotePaymentMethod
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      purchase_id: state.id,
      total: normalizeNumber(state.total),
      payment_method: remotePaymentMethod,
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

async function verifyPurchaseDelete(event) {
  const businessId = normalizeText(event?.business_id);
  const purchaseId = normalizeText(event?.payload?.purchase_id);

  if (!businessId || !purchaseId) {
    return reject('Mutación purchase.delete sin identificadores', {
      business_id: businessId,
      purchase_id: purchaseId
    });
  }

  const state = await getPurchaseState({ businessId, purchaseId });
  if (state) {
    return reject('Compra sigue presente en remoto tras delete', {
      business_id: businessId,
      purchase_id: purchaseId
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'verify', {
      purchase_id: purchaseId,
      deleted_remote: true
    })
  };
}

async function pushTableCreateToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id || payload?.table?.business_id);
  const tableId = normalizeText(payload?.table_id || payload?.table?.id);

  if (!businessId || !tableId) {
    return reject('Mutación table.create sin identificadores válidos', {
      business_id: businessId,
      table_id: tableId
    });
  }

  const existing = await getTableState({ businessId, tableId });
  if (existing) {
    return { ok: true, businessId, tableId, alreadyPresent: true };
  }

  const source = payload?.table && typeof payload.table === 'object' ? payload.table : {};
  const row = {
    id: tableId,
    business_id: businessId,
    table_number: normalizeText(source?.table_number || payload?.table_number),
    status: normalizeText(source?.status || payload?.status) || 'available',
    current_order_id: normalizeText(source?.current_order_id || payload?.current_order_id),
    created_at: source?.created_at || new Date().toISOString()
  };

  if (!row.table_number) {
    return reject('Mutación table.create sin table_number', {
      business_id: businessId,
      table_id: tableId
    });
  }

  const { error } = await supabaseAdapter.insertTable(row);
  if (error && !isDuplicateKeyError(error)) {
    return reject('No se pudo sincronizar table.create en remoto', {
      business_id: businessId,
      table_id: tableId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, businessId, tableId };
}

async function pushOrderCreateToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id || payload?.order?.business_id);
  const orderId = normalizeText(payload?.order_id || payload?.order?.id);
  const tableId = normalizeText(payload?.table_id || payload?.order?.table_id);

  if (!businessId || !orderId || !tableId) {
    return reject('Mutación order.create sin identificadores válidos', {
      business_id: businessId,
      order_id: orderId,
      table_id: tableId
    });
  }

  const existing = await getOrderState({ businessId, orderId });
  if (!existing) {
    const source = payload?.order && typeof payload.order === 'object' ? payload.order : {};
    const row = {
      id: orderId,
      business_id: businessId,
      table_id: tableId,
      user_id: normalizeText(source?.user_id || payload?.user_id),
      status: normalizeText(source?.status || payload?.status) || 'open',
      total: normalizeNumber(source?.total ?? payload?.total, 0),
      opened_at: source?.opened_at || payload?.opened_at || new Date().toISOString()
    };

    const { error: createOrderError } = await supabaseAdapter.insertOrder(row);
    if (createOrderError && !isDuplicateKeyError(createOrderError)) {
      if (isRetriableSyncError(createOrderError)) {
        throw new Error(`SYNC_RETRYABLE_ORDER_CREATE: ${createOrderError?.message || String(createOrderError)}`);
      }
      return reject('No se pudo sincronizar order.create en remoto', {
        business_id: businessId,
        order_id: orderId,
        table_id: tableId,
        error: createOrderError?.message || String(createOrderError)
      });
    }
  }

  const { error: occupyTableError } = await supabaseAdapter.updateTableById(tableId, {
    current_order_id: orderId,
    status: 'occupied'
  });
  if (occupyTableError && !isMissingTablesUpdatedAtColumnError(occupyTableError)) {
    if (isRetriableSyncError(occupyTableError)) {
      throw new Error(`SYNC_RETRYABLE_ORDER_OCCUPY_TABLE: ${occupyTableError?.message || String(occupyTableError)}`);
    }
    return reject('No se pudo sincronizar ocupación de mesa en order.create', {
      business_id: businessId,
      order_id: orderId,
      table_id: tableId,
      error: occupyTableError?.message || String(occupyTableError)
    });
  }

  return { ok: true, businessId, orderId, tableId };
}

async function pushOrderTotalUpdateToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id);
  const orderId = normalizeText(payload?.order_id);

  if (!businessId || !orderId) {
    return reject('Mutación order.total.update sin identificadores', {
      business_id: businessId,
      order_id: orderId
    });
  }

  const { error } = await supabaseAdapter.updateOrderById(orderId, {
    total: normalizeNumber(payload?.total, 0)
  });
  if (error) {
    return reject('No se pudo sincronizar order.total.update en remoto', {
      business_id: businessId,
      order_id: orderId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, businessId, orderId };
}

async function pushOrderItemInsertToRemote(event) {
  const payload = event?.payload || {};
  const itemId = normalizeText(payload?.item_id);
  const orderId = normalizeText(payload?.order_id);
  const productId = normalizeText(payload?.product_id);
  const comboId = normalizeText(payload?.combo_id);
  const quantity = normalizeNumber(payload?.quantity);
  const price = normalizeNumber(payload?.price);

  if (!itemId || !orderId) {
    return reject('Mutación order.item.insert sin identificadores', {
      item_id: itemId,
      order_id: orderId
    });
  }

  const existing = await getOrderItemState(itemId);
  if (existing) {
    return { ok: true, itemId, alreadyPresent: true };
  }

  const existingByReference = await getOrderItemStateByOrderAndReference({
    orderId,
    productId,
    comboId
  });
  if (existingByReference?.id) {
    const currentQty = normalizeNumber(existingByReference.quantity);
    const incomingQty = Number.isFinite(quantity) ? quantity : 0;
    const nextQuantity = Number.isFinite(currentQty) ? (currentQty + incomingQty) : incomingQty;
    const { error: mergeError } = await supabaseAdapter.updateOrderItemById(existingByReference.id, {
      quantity: nextQuantity
    });
    if (mergeError) {
      return reject('No se pudo fusionar order.item.insert duplicado en remoto', {
        item_id: itemId,
        existing_item_id: existingByReference.id,
        order_id: orderId,
        error: mergeError?.message || String(mergeError)
      });
    }
    return {
      ok: true,
      itemId: existingByReference.id,
      orderId,
      mergedIntoExisting: true
    };
  }

  const row = {
    id: itemId,
    order_id: orderId,
    product_id: productId,
    combo_id: comboId,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    price: Number.isFinite(price) ? price : 0
  };

  const { error } = await supabaseAdapter.insertOrderItem(row, 'id');
  if (error && !isDuplicateKeyError(error)) {
    return reject('No se pudo sincronizar order.item.insert en remoto', {
      item_id: itemId,
      order_id: orderId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, itemId, orderId };
}

async function pushOrderItemUpdateQuantityToRemote(event) {
  const payload = event?.payload || {};
  const itemId = normalizeText(payload?.item_id);

  if (!itemId) {
    return reject('Mutación order.item.update_quantity sin item_id', {
      item_id: itemId
    });
  }

  const { error } = await supabaseAdapter.updateOrderItemById(itemId, {
    quantity: normalizeNumber(payload?.quantity, 0)
  });
  if (error) {
    return reject('No se pudo sincronizar order.item.update_quantity en remoto', {
      item_id: itemId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, itemId };
}

async function pushOrderItemBulkQuantityUpdateToRemote(event) {
  const payload = event?.payload || {};
  const updates = Array.isArray(payload?.updates) ? payload.updates : [];
  if (updates.length === 0) {
    return verifySkip(event, 'missing_updates');
  }

  const updateResults = await Promise.all(
    updates.map((update) => {
      const itemId = normalizeText(update?.item_id);
      if (!itemId) return Promise.resolve({ error: null });
      return supabaseAdapter.updateOrderItemById(itemId, {
        quantity: normalizeNumber(update?.quantity, 0)
      });
    })
  );
  const failed = updateResults.find((result) => result?.error);
  if (failed?.error) {
    return reject('No se pudo sincronizar order.item.bulk_quantity_update en remoto', {
      error: failed.error?.message || String(failed.error)
    });
  }

  return { ok: true };
}

async function pushOrderItemDeleteToRemote(event) {
  const payload = event?.payload || {};
  const itemId = normalizeText(payload?.item_id);
  if (!itemId) {
    return reject('Mutación order.item.delete sin item_id', {
      item_id: itemId
    });
  }

  const { error } = await supabaseAdapter.deleteOrderItemById(itemId);
  if (error) {
    return reject('No se pudo sincronizar order.item.delete en remoto', {
      item_id: itemId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, itemId };
}

async function pushOrderDeleteAndReleaseTableToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id);
  const orderId = normalizeText(payload?.order_id);
  const tableId = normalizeText(payload?.table_id);

  if (!businessId || !orderId || !tableId) {
    return reject('Mutación order.delete_and_release_table sin identificadores', {
      business_id: businessId,
      order_id: orderId,
      table_id: tableId
    });
  }

  const { error: releaseTableError } = await supabaseAdapter.updateTableByBusinessAndId({
    businessId,
    tableId,
    payload: {
      current_order_id: null,
      status: 'available'
    }
  });
  if (releaseTableError && !isMissingTablesUpdatedAtColumnError(releaseTableError)) {
    return reject('No se pudo sincronizar liberación de mesa en remoto', {
      business_id: businessId,
      table_id: tableId,
      error: releaseTableError?.message || String(releaseTableError)
    });
  }

  const { error: deleteOrderError } = await supabaseAdapter.deleteOrderById(orderId);
  if (deleteOrderError) {
    return reject('No se pudo sincronizar eliminación de orden en remoto', {
      business_id: businessId,
      order_id: orderId,
      error: deleteOrderError?.message || String(deleteOrderError)
    });
  }

  return { ok: true, businessId, orderId, tableId };
}

async function pushTableDeleteCascadeOrdersToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id);
  const tableId = normalizeText(payload?.table_id);

  if (!businessId || !tableId) {
    return reject('Mutación table.delete_cascade_orders sin identificadores', {
      business_id: businessId,
      table_id: tableId
    });
  }

  const { error: releaseTableError } = await supabaseAdapter.updateTableByBusinessAndId({
    businessId,
    tableId,
    payload: {
      current_order_id: null,
      status: 'available'
    }
  });
  if (releaseTableError && !isMissingTablesUpdatedAtColumnError(releaseTableError)) {
    return reject('No se pudo liberar mesa antes del borrado en remoto', {
      business_id: businessId,
      table_id: tableId,
      error: releaseTableError?.message || String(releaseTableError)
    });
  }

  const { error: deleteOrdersError } = await supabaseAdapter.deleteOrdersByBusinessAndTableId({
    businessId,
    tableId
  });
  if (deleteOrdersError) {
    return reject('No se pudo sincronizar borrado de órdenes por mesa', {
      business_id: businessId,
      table_id: tableId,
      error: deleteOrdersError?.message || String(deleteOrdersError)
    });
  }

  const { error: deleteTableError } = await supabaseAdapter.deleteTableByBusinessAndId({
    businessId,
    tableId
  });
  if (deleteTableError) {
    return reject('No se pudo sincronizar borrado de mesa', {
      business_id: businessId,
      table_id: tableId,
      error: deleteTableError?.message || String(deleteTableError)
    });
  }

  return { ok: true, businessId, tableId };
}

async function verifyTableCreate(event) {
  const businessId = normalizeText(event?.business_id);
  const tableId = normalizeText(event?.payload?.table_id);
  const expectedTableNumber = normalizeText(event?.payload?.table_number);

  if (!businessId || !tableId) {
    return verifySkip(event, 'missing_business_or_table_id');
  }

  let state = await getTableState({ businessId, tableId });
  let verifyMode = 'verify';
  if (!state) {
    const pushResult = await pushTableCreateToRemote(event);
    if (!pushResult?.ok) return pushResult;
    state = await getTableState({ businessId, tableId });
    verifyMode = 'push-verify';
  }

  if (!state) {
    return reject('Mesa no visible en remoto tras create', {
      business_id: businessId,
      table_id: tableId
    });
  }

  const currentTableNumber = normalizeText(state.table_number);
  if (expectedTableNumber && currentTableNumber && expectedTableNumber !== currentTableNumber) {
    return reject('Número de mesa no coincide en remoto', {
      table_id: tableId,
      expected_table_number: expectedTableNumber,
      current_table_number: currentTableNumber
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      table_id: state.id,
      table_number: state.table_number,
      status: normalizeText(state.status),
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

async function verifyOrderCreate(event) {
  const businessId = normalizeText(event?.business_id);
  const orderId = normalizeText(event?.payload?.order_id);
  const expectedTableId = normalizeText(event?.payload?.table_id);

  if (!businessId || !orderId) {
    return reject('Mutación order.create sin identificadores', {
      business_id: businessId,
      order_id: orderId
    });
  }

  let state = await getOrderState({ businessId, orderId });
  let verifyMode = 'verify';
  if (!state) {
    const pushResult = await pushOrderCreateToRemote(event);
    if (!pushResult?.ok) return pushResult;
    state = await getOrderState({ businessId, orderId });
    verifyMode = 'push-verify';
  }

  if (!state) {
    return reject('Orden no visible en remoto tras create', {
      business_id: businessId,
      order_id: orderId
    });
  }

  const currentTableId = normalizeText(state.table_id);
  if (expectedTableId && currentTableId && expectedTableId !== currentTableId) {
    return reject('Mesa asociada a orden no coincide en remoto', {
      order_id: orderId,
      expected_table_id: expectedTableId,
      current_table_id: currentTableId
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      order_id: state.id,
      table_id: currentTableId,
      status: normalizeText(state.status),
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

async function verifyOrderTotalUpdate(event) {
  const businessId = normalizeText(event?.business_id);
  const orderId = normalizeText(event?.payload?.order_id);

  if (!businessId || !orderId) {
    return verifySkip(event, 'missing_business_or_order_id');
  }

  const pushResult = await pushOrderTotalUpdateToRemote(event);
  if (!pushResult?.ok) return pushResult;

  const state = await getOrderState({ businessId, orderId });
  if (!state) {
    return verifySkip(event, 'order_not_found_current_state', {
      order_id: orderId
    });
  }

  if (hasNumericMismatch(event?.payload?.total, state.total)) {
    return verifySkip(event, 'order_total_superseded', {
      order_id: orderId,
      expected_total: normalizeNumber(event?.payload?.total),
      current_total: normalizeNumber(state.total)
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'push-verify', {
      order_id: state.id,
      total: normalizeNumber(state.total),
      pushed_to_remote: true
    })
  };
}

async function verifyOrderItemInsert(event) {
  const itemId = normalizeText(event?.payload?.item_id);

  if (!itemId) {
    return verifySkip(event, 'missing_item_id');
  }

  let state = await getOrderItemState(itemId);
  let verifyMode = 'verify';
  if (!state) {
    const pushResult = await pushOrderItemInsertToRemote(event);
    if (!pushResult?.ok) return pushResult;
    state = await getOrderItemState(itemId);
    verifyMode = 'push-verify';
  }

  if (!state) {
    return verifySkip(event, 'order_item_not_found_current_state', {
      item_id: itemId
    });
  }

  if (hasNumericMismatch(event?.payload?.quantity, state.quantity, 0.000001)) {
    return verifySkip(event, 'order_item_quantity_superseded', {
      item_id: itemId,
      expected_quantity: normalizeNumber(event?.payload?.quantity),
      current_quantity: normalizeNumber(state.quantity)
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      item_id: state.id,
      order_id: normalizeText(state.order_id),
      quantity: normalizeNumber(state.quantity),
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

async function verifyOrderItemUpdateQuantity(event) {
  const itemId = normalizeText(event?.payload?.item_id);

  if (!itemId) {
    return verifySkip(event, 'missing_item_id');
  }

  const pushResult = await pushOrderItemUpdateQuantityToRemote(event);
  if (!pushResult?.ok) return pushResult;

  const state = await getOrderItemState(itemId);
  if (!state) {
    return verifySkip(event, 'order_item_not_found_current_state', {
      item_id: itemId
    });
  }

  if (hasNumericMismatch(event?.payload?.quantity, state.quantity, 0.000001)) {
    return verifySkip(event, 'order_item_quantity_superseded', {
      item_id: itemId,
      expected_quantity: normalizeNumber(event?.payload?.quantity),
      current_quantity: normalizeNumber(state.quantity)
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'push-verify', {
      item_id: state.id,
      order_id: normalizeText(state.order_id),
      quantity: normalizeNumber(state.quantity),
      pushed_to_remote: true
    })
  };
}

async function verifyOrderItemBulkQuantityUpdate(event) {
  const updates = Array.isArray(event?.payload?.updates) ? event.payload.updates : [];
  if (updates.length === 0) {
    return verifySkip(event, 'missing_updates');
  }

  const pushResult = await pushOrderItemBulkQuantityUpdateToRemote(event);
  if (!pushResult?.ok) return pushResult;

  const itemIds = normalizeIdArray(updates.map((update) => update?.item_id));
  if (itemIds.length === 0) {
    return verifySkip(event, 'missing_item_ids');
  }

  const rows = await getOrderItemsStateByIds(itemIds);
  if (rows.length === 0) {
    return verifySkip(event, 'order_items_not_found_current_state');
  }

  const stateMap = new Map(rows.map((row) => [normalizeText(row.id), row]));
  const mismatched = [];

  updates.forEach((update) => {
    const itemId = normalizeText(update?.item_id);
    if (!itemId) return;

    const state = stateMap.get(itemId);
    if (!state) return;

    if (hasNumericMismatch(update?.quantity, state.quantity, 0.000001)) {
      mismatched.push({
        item_id: itemId,
        expected_quantity: normalizeNumber(update?.quantity),
        current_quantity: normalizeNumber(state.quantity)
      });
    }
  });

  if (mismatched.length > 0) {
    return verifySkip(event, 'order_item_bulk_quantity_superseded', {
      mismatched
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'push-verify', {
      verified_items: rows.length,
      pushed_to_remote: true
    })
  };
}

async function verifyOrderItemDelete(event) {
  const itemId = normalizeText(event?.payload?.item_id);

  if (!itemId) {
    return reject('Mutación order.item.delete sin item_id', {
      item_id: itemId
    });
  }

  const pushResult = await pushOrderItemDeleteToRemote(event);
  if (!pushResult?.ok) return pushResult;

  const state = await getOrderItemState(itemId);
  if (state) {
    return reject('Item de orden sigue presente en remoto tras delete', {
      item_id: itemId,
      order_id: normalizeText(state.order_id)
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'push-verify', {
      item_id: itemId,
      deleted_remote: true,
      pushed_to_remote: true
    })
  };
}

async function verifyOrderDeleteAndReleaseTable(event) {
  const businessId = normalizeText(event?.business_id);
  const orderId = normalizeText(event?.payload?.order_id);
  const tableId = normalizeText(event?.payload?.table_id);

  if (!businessId || !orderId || !tableId) {
    return reject('Mutación order.delete_and_release_table sin identificadores', {
      business_id: businessId,
      order_id: orderId,
      table_id: tableId
    });
  }

  const pushResult = await pushOrderDeleteAndReleaseTableToRemote(event);
  if (!pushResult?.ok) return pushResult;

  const orderState = await getOrderState({ businessId, orderId });
  if (orderState) {
    return reject('Orden sigue presente en remoto tras delete_and_release_table', {
      order_id: orderId,
      current_status: normalizeText(orderState.status)
    });
  }

  const tableState = await getTableState({ businessId, tableId });
  if (!tableState) {
    return reject('Mesa no encontrada en remoto tras liberar orden', {
      table_id: tableId,
      business_id: businessId
    });
  }

  if (normalizeText(tableState.current_order_id)) {
    return reject('Mesa aún mantiene orden activa tras liberar orden', {
      table_id: tableId,
      current_order_id: normalizeText(tableState.current_order_id)
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'push-verify', {
      order_id: orderId,
      table_id: tableId,
      table_status: normalizeText(tableState.status),
      pushed_to_remote: true
    })
  };
}

async function verifyTableDeleteCascadeOrders(event) {
  const businessId = normalizeText(event?.business_id);
  const tableId = normalizeText(event?.payload?.table_id);

  if (!businessId || !tableId) {
    return reject('Mutación table.delete_cascade_orders sin identificadores', {
      business_id: businessId,
      table_id: tableId
    });
  }

  const pushResult = await pushTableDeleteCascadeOrdersToRemote(event);
  if (!pushResult?.ok) return pushResult;

  const tableState = await getTableState({ businessId, tableId });
  if (tableState) {
    return reject('Mesa sigue presente en remoto tras delete_cascade_orders', {
      table_id: tableId,
      business_id: businessId
    });
  }

  const orders = await getOrdersByTableId({ businessId, tableId });
  if ((orders || []).length > 0) {
    return reject('Aún existen órdenes para la mesa tras delete_cascade_orders', {
      table_id: tableId,
      orders_count: orders.length
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'push-verify', {
      table_id: tableId,
      deleted_remote: true,
      pushed_to_remote: true
    })
  };
}

async function verifyOrderCloseSingle(event) {
  const businessId = normalizeText(event?.business_id);
  const orderId = normalizeText(event?.payload?.order_id);
  const tableId = normalizeText(event?.payload?.table_id);
  const saleId = normalizeText(event?.payload?.sale_id);

  if (!businessId || !saleId) {
    return reject('Mutación order.close.single sin identificadores', {
      business_id: businessId,
      order_id: orderId,
      sale_id: saleId
    });
  }

  const saleState = await getSaleState({ businessId, saleId });
  if (!saleState) {
    return reject('Venta no visible en remoto tras order.close.single', {
      sale_id: saleId,
      business_id: businessId
    });
  }

  if (orderId) {
    const orderState = await getOrderState({ businessId, orderId });
    if (orderState && normalizeText(orderState.status) !== 'closed') {
      return reject('Orden no quedó cerrada tras order.close.single', {
        order_id: orderId,
        current_status: normalizeText(orderState.status)
      });
    }
  }

  if (tableId) {
    const tableState = await getTableState({ businessId, tableId });
    if (!tableState) {
      return reject('Mesa no encontrada tras order.close.single', {
        table_id: tableId
      });
    }

    if (normalizeText(tableState.current_order_id)) {
      return reject('Mesa mantiene orden activa tras order.close.single', {
        table_id: tableId,
        current_order_id: normalizeText(tableState.current_order_id)
      });
    }
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'verify', {
      order_id: orderId,
      table_id: tableId,
      sale_id: saleId
    })
  };
}

async function verifyOrderCloseSplit(event) {
  const businessId = normalizeText(event?.business_id);
  const orderId = normalizeText(event?.payload?.order_id);
  const tableId = normalizeText(event?.payload?.table_id);
  const saleIds = normalizeIdArray(event?.payload?.sale_ids);

  if (!businessId) {
    return reject('Mutación order.close.split sin business_id', {
      business_id: businessId,
      order_id: orderId,
      table_id: tableId
    });
  }

  if (saleIds.length > 0) {
    const saleRows = await getSalesStateByIds({
      businessId,
      saleIds
    });

    const foundSaleIds = new Set((saleRows || []).map((row) => normalizeText(row.id)).filter(Boolean));
    const missingSaleIds = saleIds.filter((saleId) => !foundSaleIds.has(saleId));

    if (missingSaleIds.length > 0) {
      return reject('Faltan ventas remotas tras order.close.split', {
        missing_sale_ids: missingSaleIds,
        expected_sales_count: saleIds.length,
        found_sales_count: foundSaleIds.size
      });
    }
  }

  if (orderId) {
    const orderState = await getOrderState({ businessId, orderId });
    if (orderState && normalizeText(orderState.status) !== 'closed') {
      return reject('Orden no quedó cerrada tras order.close.split', {
        order_id: orderId,
        current_status: normalizeText(orderState.status)
      });
    }
  }

  if (tableId) {
    const tableState = await getTableState({ businessId, tableId });
    if (!tableState) {
      return reject('Mesa no encontrada tras order.close.split', {
        table_id: tableId
      });
    }

    if (normalizeText(tableState.current_order_id)) {
      return reject('Mesa mantiene orden activa tras order.close.split', {
        table_id: tableId,
        current_order_id: normalizeText(tableState.current_order_id)
      });
    }
  }

  if (saleIds.length === 0 && !orderId && !tableId) {
    return verifySkip(event, 'missing_sale_ids_and_order_context');
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, saleIds.length > 0 ? 'verify' : 'verify-partial', {
      order_id: orderId,
      table_id: tableId,
      sales_verified: saleIds.length
    })
  };
}

function isDuplicateKeyError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('duplicate key')
    || message.includes('23505')
    || message.includes('already exists')
  );
}

function isMissingTablesUpdatedAtColumnError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('column "updated_at"')
    && message.includes('relation "tables"')
    && message.includes('does not exist')
  );
}

function isMissingSupplierColumnErrorLike(errorLike, columnName) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  const target = String(columnName || '').trim().toLowerCase();
  return Boolean(
    target
    && message.includes(target)
    && (
      message.includes('column')
      || message.includes('does not exist')
      || message.includes('schema cache')
      || message.includes('pgrst')
    )
  );
}

function normalizeSupplierTaxColumn(value) {
  return String(value || '').trim().toLowerCase() === 'tax_id'
    ? 'tax_id'
    : 'nit';
}

function buildSupplierWritePayload({ supplier = {}, taxColumn = 'nit' }) {
  const basePayload = {
    business_name: supplier?.business_name || '',
    contact_name: supplier?.contact_name || null,
    email: supplier?.email || null,
    phone: supplier?.phone || null,
    address: supplier?.address || null,
    notes: supplier?.notes || null
  };

  if (taxColumn === 'tax_id') {
    basePayload.tax_id = supplier?.tax_id ?? supplier?.nit ?? null;
  } else {
    basePayload.nit = supplier?.nit ?? supplier?.tax_id ?? null;
  }

  return basePayload;
}

async function pushProductCreateToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id || payload?.product?.business_id);
  const productId = normalizeText(payload?.product_id || payload?.product?.id);

  if (!businessId || !productId) {
    return reject('Mutación product.create sin identificadores válidos', {
      business_id: businessId,
      product_id: productId
    });
  }

  const existing = await getProductState({ businessId, productId });
  if (existing) {
    return { ok: true, businessId, productId, alreadyPresent: true };
  }

  const source = payload?.product && typeof payload.product === 'object' ? payload.product : {};
  const row = {
    id: productId,
    business_id: businessId,
    code: normalizeText(source?.code) || `LCL-${String(productId).replace(/-/g, '').slice(0, 8)}`,
    name: normalizeText(source?.name),
    category: normalizeText(source?.category),
    purchase_price: Number(source?.purchase_price ?? payload?.purchase_price ?? 0),
    sale_price: Number(source?.sale_price ?? payload?.sale_price ?? 0),
    stock: Number(source?.stock ?? payload?.stock ?? 0),
    min_stock: Number(source?.min_stock ?? payload?.min_stock ?? 0),
    unit: normalizeText(source?.unit) || 'unit',
    supplier_id: normalizeText(source?.supplier_id ?? payload?.supplier_id),
    is_active: source?.is_active !== false,
    manage_stock: source?.manage_stock !== false,
    created_at: source?.created_at || new Date().toISOString()
  };

  if (!row.name) {
    return reject('Mutación product.create sin nombre de producto', {
      product_id: productId,
      business_id: businessId
    });
  }

  const { error } = await supabaseAdapter.insertProduct(row);
  if (error && !isDuplicateKeyError(error)) {
    return reject('No se pudo sincronizar product.create en remoto', {
      business_id: businessId,
      product_id: productId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, businessId, productId };
}

async function pushProductUpdateToRemote(event) {
  const payload = event?.payload || {};
  const productId = normalizeText(payload?.product_id);
  const businessId = normalizeText(event?.business_id || payload?.business_id);

  if (!productId) {
    return reject('Mutación product.update sin product_id', {
      product_id: productId,
      business_id: businessId
    });
  }

  const sourceUpdate = payload?.update && typeof payload.update === 'object' ? payload.update : {};
  const updatePayload = { ...sourceUpdate };

  if (!('is_active' in updatePayload) && typeof payload?.is_active === 'boolean') {
    updatePayload.is_active = payload.is_active;
  }
  if (!('manage_stock' in updatePayload) && typeof payload?.manage_stock === 'boolean') {
    updatePayload.manage_stock = payload.manage_stock;
  }
  if (!('supplier_id' in updatePayload) && payload?.supplier_id !== undefined) {
    updatePayload.supplier_id = payload.supplier_id;
  }

  if (Object.keys(updatePayload).length === 0) {
    return verifySkip(event, 'missing_update_payload', {
      product_id: productId
    });
  }

  const { error } = await supabaseAdapter.updateProductById(productId, updatePayload);
  if (error) {
    return reject('No se pudo sincronizar product.update en remoto', {
      product_id: productId,
      business_id: businessId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, businessId, productId };
}

async function pushProductDeleteToRemote(event) {
  const payload = event?.payload || {};
  const productId = normalizeText(payload?.product_id);
  const businessId = normalizeText(event?.business_id || payload?.business_id);

  if (!productId) {
    return reject('Mutación product.delete sin product_id', {
      product_id: productId,
      business_id: businessId
    });
  }

  const { error } = await supabaseAdapter.deleteProductById(productId);
  if (error) {
    return reject('No se pudo sincronizar product.delete en remoto', {
      product_id: productId,
      business_id: businessId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, businessId, productId };
}

async function pushSupplierCreateToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id || payload?.supplier?.business_id);
  const supplierId = normalizeText(payload?.supplier_id || payload?.supplier?.id);
  const source = payload?.supplier && typeof payload.supplier === 'object' ? payload.supplier : {};
  const taxColumn = normalizeSupplierTaxColumn(payload?.tax_column);

  if (!businessId || !supplierId) {
    return reject('Mutación supplier.create sin identificadores válidos', {
      business_id: businessId,
      supplier_id: supplierId
    });
  }

  const existing = await getSupplierState({ businessId, supplierId });
  if (existing) {
    return { ok: true, businessId, supplierId, alreadyPresent: true };
  }

  const supplierWritePayload = buildSupplierWritePayload({ supplier: source, taxColumn });
  const createRow = {
    id: supplierId,
    business_id: businessId,
    ...supplierWritePayload,
    created_at: source?.created_at || new Date().toISOString()
  };

  if (!normalizeText(createRow.business_name)) {
    return reject('Mutación supplier.create sin business_name', {
      supplier_id: supplierId,
      business_id: businessId
    });
  }

  let { error } = await supabaseAdapter.insertSupplier(createRow);
  if (error && isMissingSupplierColumnErrorLike(error, taxColumn)) {
    const fallbackTaxColumn = taxColumn === 'nit' ? 'tax_id' : 'nit';
    const fallbackRow = {
      id: supplierId,
      business_id: businessId,
      ...buildSupplierWritePayload({ supplier: source, taxColumn: fallbackTaxColumn }),
      created_at: createRow.created_at
    };
    ({ error } = await supabaseAdapter.insertSupplier(fallbackRow));
  }

  if (error && !isDuplicateKeyError(error)) {
    return reject('No se pudo sincronizar supplier.create en remoto', {
      supplier_id: supplierId,
      business_id: businessId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, businessId, supplierId };
}

async function pushSupplierUpdateToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id);
  const supplierId = normalizeText(payload?.supplier_id);
  const source = payload?.update && typeof payload.update === 'object' ? payload.update : {};
  const taxColumn = normalizeSupplierTaxColumn(payload?.tax_column);

  if (!businessId || !supplierId) {
    return reject('Mutación supplier.update sin identificadores válidos', {
      business_id: businessId,
      supplier_id: supplierId
    });
  }

  let updatePayload = buildSupplierWritePayload({ supplier: source, taxColumn });
  if (!normalizeText(updatePayload.business_name)) {
    updatePayload = {
      ...updatePayload,
      business_name: source?.business_name || 'Proveedor'
    };
  }

  let { error } = await supabaseAdapter.updateSupplierById(supplierId, updatePayload);
  if (error && isMissingSupplierColumnErrorLike(error, taxColumn)) {
    const fallbackTaxColumn = taxColumn === 'nit' ? 'tax_id' : 'nit';
    ({ error } = await supabaseAdapter.updateSupplierById(
      supplierId,
      buildSupplierWritePayload({ supplier: source, taxColumn: fallbackTaxColumn })
    ));
  }

  if (error) {
    return reject('No se pudo sincronizar supplier.update en remoto', {
      supplier_id: supplierId,
      business_id: businessId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, businessId, supplierId };
}

async function pushSupplierDeleteToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id);
  const supplierId = normalizeText(payload?.supplier_id);

  if (!businessId || !supplierId) {
    return reject('Mutación supplier.delete sin identificadores válidos', {
      business_id: businessId,
      supplier_id: supplierId
    });
  }

  const { error } = await supabaseAdapter.deleteSupplierById(supplierId);
  if (error) {
    return reject('No se pudo sincronizar supplier.delete en remoto', {
      supplier_id: supplierId,
      business_id: businessId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, businessId, supplierId };
}

async function verifyProductCreate(event) {
  const businessId = normalizeText(event?.business_id);
  const productId = normalizeText(event?.payload?.product_id);

  if (!businessId || !productId) {
    return verifySkip(event, 'missing_business_or_product_id');
  }

  let state = await getProductState({ businessId, productId });
  let verifyMode = 'verify';
  if (!state) {
    const pushResult = await pushProductCreateToRemote(event);
    if (!pushResult?.ok) return pushResult;
    state = await getProductState({ businessId, productId });
    verifyMode = 'push-verify';
  }

  if (!state) {
    return reject('Producto no visible en remoto', {
      product_id: productId,
      business_id: businessId
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      product_id: state.id,
      is_active: state.is_active !== false,
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

async function verifyProductUpdate(event) {
  const businessId = normalizeText(event?.business_id);
  const productId = normalizeText(event?.payload?.product_id);

  if (!businessId || !productId) {
    return reject('Mutación de producto sin identificadores', {
      business_id: businessId,
      product_id: productId
    });
  }

  const pushResult = await pushProductUpdateToRemote(event);
  if (!pushResult?.ok) return pushResult;

  const state = await getProductState({ businessId, productId });
  if (!state) {
    return reject('Producto no encontrado en remoto tras update', {
      product_id: productId,
      business_id: businessId
    });
  }

  const expectedActive = event?.payload?.is_active;
  if (typeof expectedActive === 'boolean' && Boolean(state.is_active) !== expectedActive) {
    return reject('Estado activo de producto no coincide en remoto', {
      product_id: productId,
      expected_is_active: expectedActive,
      current_is_active: Boolean(state.is_active)
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'verify', {
      product_id: state.id,
      is_active: state.is_active !== false
    })
  };
}

async function verifyProductDelete(event) {
  const businessId = normalizeText(event?.business_id);
  const productId = normalizeText(event?.payload?.product_id);

  if (!businessId || !productId) {
    return reject('Mutación product.delete sin identificadores', {
      business_id: businessId,
      product_id: productId
    });
  }

  const pushResult = await pushProductDeleteToRemote(event);
  if (!pushResult?.ok) return pushResult;

  const state = await getProductState({ businessId, productId });
  if (state) {
    return reject('Producto sigue presente en remoto tras delete', {
      product_id: productId,
      business_id: businessId
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'verify', {
      product_id: productId,
      deleted_remote: true
    })
  };
}

async function verifySupplierCreate(event) {
  const businessId = normalizeText(event?.business_id);
  const supplierId = normalizeText(event?.payload?.supplier_id);

  if (!businessId || !supplierId) {
    return verifySkip(event, 'missing_business_or_supplier_id');
  }

  let state = await getSupplierState({ businessId, supplierId });
  let verifyMode = 'verify';
  if (!state) {
    const pushResult = await pushSupplierCreateToRemote(event);
    if (!pushResult?.ok) return pushResult;
    state = await getSupplierState({ businessId, supplierId });
    verifyMode = 'push-verify';
  }

  if (!state) {
    return reject('Proveedor no visible en remoto tras create', {
      supplier_id: supplierId,
      business_id: businessId
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      supplier_id: state.id,
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

async function verifySupplierUpdate(event) {
  const businessId = normalizeText(event?.business_id);
  const supplierId = normalizeText(event?.payload?.supplier_id);

  if (!businessId || !supplierId) {
    return reject('Mutación supplier.update sin identificadores', {
      supplier_id: supplierId,
      business_id: businessId
    });
  }

  const pushResult = await pushSupplierUpdateToRemote(event);
  if (!pushResult?.ok) return pushResult;

  const state = await getSupplierState({ businessId, supplierId });
  if (!state) {
    return reject('Proveedor no visible en remoto tras update', {
      supplier_id: supplierId,
      business_id: businessId
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'push-verify', {
      supplier_id: state.id,
      pushed_to_remote: true
    })
  };
}

async function verifySupplierDelete(event) {
  const businessId = normalizeText(event?.business_id);
  const supplierId = normalizeText(event?.payload?.supplier_id);

  if (!businessId || !supplierId) {
    return reject('Mutación supplier.delete sin identificadores', {
      supplier_id: supplierId,
      business_id: businessId
    });
  }

  const pushResult = await pushSupplierDeleteToRemote(event);
  if (!pushResult?.ok) return pushResult;

  const state = await getSupplierState({ businessId, supplierId });
  if (state) {
    return reject('Proveedor sigue presente en remoto tras delete', {
      supplier_id: supplierId,
      business_id: businessId
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, 'push-verify', {
      supplier_id: supplierId,
      deleted_remote: true,
      pushed_to_remote: true
    })
  };
}

async function pushInvoiceCreateToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id || payload?.invoice?.business_id);
  const invoiceId = normalizeText(payload?.invoice_id || payload?.invoice?.id);

  if (!businessId || !invoiceId) {
    return reject('Mutación invoice.create sin identificadores válidos', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  const currentState = await getInvoiceState({ businessId, invoiceId });
  if (currentState) {
    return { ok: true, businessId, invoiceId, alreadyPresent: true };
  }

  const invoicePayload = payload?.invoice && typeof payload.invoice === 'object' ? payload.invoice : {};
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  const normalizedItems = rawItems.map((item = {}) => ({
    product_id: normalizeText(item?.product_id),
    product_name: item?.product_name || 'Producto',
    quantity: Number(item?.quantity || 0),
    unit_price: Number(item?.unit_price || 0),
    total: Number(item?.total || (Number(item?.quantity || 0) * Number(item?.unit_price || 0)))
  })).filter((item) => item.product_id && item.quantity > 0);

  let invoiceNumber = normalizeText(invoicePayload?.invoice_number || payload?.invoice_number);
  if (!invoiceNumber) {
    const { data: generatedInvoiceNumber, error: numberError } = await supabaseAdapter.generateInvoiceNumber(businessId);
    if (numberError) {
      return reject('No se pudo generar número de factura para sincronizar invoice.create', {
        business_id: businessId,
        invoice_id: invoiceId,
        error: numberError?.message || String(numberError)
      });
    }
    invoiceNumber = normalizeText(generatedInvoiceNumber);
  }

  const total = Number(invoicePayload?.total ?? payload?.total ?? 0);
  const nowIso = new Date().toISOString();
  const invoiceRow = {
    id: invoiceId,
    business_id: businessId,
    employee_id: normalizeText(invoicePayload?.employee_id),
    invoice_number: invoiceNumber,
    customer_name: invoicePayload?.customer_name || 'Consumidor Final',
    customer_email: normalizeText(invoicePayload?.customer_email),
    customer_id_number: normalizeText(invoicePayload?.customer_id_number),
    payment_method: normalizeText(invoicePayload?.payment_method) || 'cash',
    subtotal: Number(invoicePayload?.subtotal ?? total),
    tax: Number(invoicePayload?.tax ?? 0),
    total,
    notes: invoicePayload?.notes || null,
    status: normalizeText(invoicePayload?.status) || 'pending',
    issued_at: invoicePayload?.issued_at || nowIso,
    created_at: invoicePayload?.created_at || nowIso
  };

  const { error: insertInvoiceError } = await supabaseAdapter.insertInvoice(invoiceRow);
  if (insertInvoiceError && !isDuplicateKeyError(insertInvoiceError)) {
    return reject('No se pudo sincronizar invoice.create en remoto', {
      business_id: businessId,
      invoice_id: invoiceId,
      error: insertInvoiceError?.message || String(insertInvoiceError)
    });
  }

  if (normalizedItems.length > 0) {
    const invoiceItemsRows = normalizedItems.map((item) => ({
      invoice_id: invoiceId,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      created_at: nowIso
    }));
    const { error: itemsError } = await supabaseAdapter.insertInvoiceItems(invoiceItemsRows);
    if (itemsError && !isDuplicateKeyError(itemsError)) {
      await supabaseAdapter.deleteInvoiceById(invoiceId);
      return reject('No se pudo sincronizar invoice.create items en remoto', {
        business_id: businessId,
        invoice_id: invoiceId,
        error: itemsError?.message || String(itemsError)
      });
    }

    const stockUpdates = normalizedItems.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity
    }));
    const { error: stockError } = await supabaseAdapter.updateStockBatch(stockUpdates);
    if (stockError) {
      await supabaseAdapter.deleteInvoiceById(invoiceId);
      return reject('No se pudo sincronizar inventario en invoice.create', {
        business_id: businessId,
        invoice_id: invoiceId,
        error: stockError?.message || String(stockError)
      });
    }
  }

  return { ok: true, businessId, invoiceId };
}

async function pushInvoiceSentToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id);
  const invoiceId = normalizeText(payload?.invoice_id);

  if (!businessId || !invoiceId) {
    return reject('Mutación invoice.sent sin identificadores válidos', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  const sentAt = payload?.sent_at || new Date().toISOString();
  const { error } = await supabaseAdapter.updateInvoiceById(invoiceId, {
    status: 'sent',
    sent_at: sentAt
  });

  if (error) {
    return reject('No se pudo sincronizar invoice.sent en remoto', {
      business_id: businessId,
      invoice_id: invoiceId,
      error: error?.message || String(error)
    });
  }

  return { ok: true, businessId, invoiceId };
}

async function pushInvoiceCancelToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id);
  const invoiceId = normalizeText(payload?.invoice_id);

  if (!businessId || !invoiceId) {
    return reject('Mutación invoice.cancel sin identificadores válidos', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  const cancelledAt = payload?.cancelled_at || new Date().toISOString();
  const { error: cancelError } = await supabaseAdapter.updateInvoiceById(invoiceId, {
    status: 'cancelled',
    cancelled_at: cancelledAt
  });
  if (cancelError) {
    return reject('No se pudo sincronizar invoice.cancel en remoto', {
      business_id: businessId,
      invoice_id: invoiceId,
      error: cancelError?.message || String(cancelError)
    });
  }

  const productUpdates = Array.isArray(payload?.product_updates) ? payload.product_updates : [];
  if (productUpdates.length > 0) {
    const normalizedUpdates = productUpdates
      .map((item = {}) => ({
        product_id: normalizeText(item?.product_id),
        quantity: Number(item?.quantity || 0)
      }))
      .filter((item) => item.product_id && item.quantity > 0);

    if (normalizedUpdates.length > 0) {
      const { error: restoreError } = await supabaseAdapter.restoreStockBatch(normalizedUpdates);
      if (restoreError) {
        return reject('No se pudo restaurar inventario en invoice.cancel', {
          business_id: businessId,
          invoice_id: invoiceId,
          error: restoreError?.message || String(restoreError)
        });
      }
    }
  }

  return { ok: true, businessId, invoiceId };
}

async function pushInvoiceDeleteToRemote(event) {
  const payload = event?.payload || {};
  const businessId = normalizeText(event?.business_id || payload?.business_id);
  const invoiceId = normalizeText(payload?.invoice_id);

  if (!businessId || !invoiceId) {
    return reject('Mutación invoice.delete sin identificadores válidos', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  const { error: deleteItemsError } = await supabaseAdapter.deleteInvoiceItemsByInvoiceId(invoiceId);
  if (deleteItemsError) {
    return reject('No se pudo eliminar invoice_items en invoice.delete', {
      business_id: businessId,
      invoice_id: invoiceId,
      error: deleteItemsError?.message || String(deleteItemsError)
    });
  }

  const { error: deleteInvoiceError } = await supabaseAdapter.deleteInvoiceById(invoiceId);
  if (deleteInvoiceError) {
    return reject('No se pudo eliminar invoice en invoice.delete', {
      business_id: businessId,
      invoice_id: invoiceId,
      error: deleteInvoiceError?.message || String(deleteInvoiceError)
    });
  }

  return { ok: true, businessId, invoiceId };
}

async function verifyInvoiceCreate(event) {
  let businessId = normalizeText(event?.business_id);
  let invoiceId = normalizeText(event?.payload?.invoice_id);
  let verifyMode = 'verify';

  if (!businessId || !invoiceId) {
    return reject('Mutación invoice.create sin identificadores', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  let state = await getInvoiceState({ businessId, invoiceId });
  if (!state) {
    const pushResult = await pushInvoiceCreateToRemote(event);
    if (!pushResult?.ok) return pushResult;
    businessId = pushResult.businessId;
    invoiceId = pushResult.invoiceId;
    verifyMode = 'push-verify';
    state = await getInvoiceState({ businessId, invoiceId });
  }

  if (!state) {
    return reject('Factura no visible en remoto tras create', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      invoice_id: state.id,
      status: state.status || null,
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

async function verifyInvoiceSent(event) {
  const businessId = normalizeText(event?.business_id);
  const invoiceId = normalizeText(event?.payload?.invoice_id);

  if (!businessId || !invoiceId) {
    return reject('Mutación invoice.sent sin identificadores', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  let state = await getInvoiceState({ businessId, invoiceId });
  let verifyMode = 'verify';
  if (!state || state.status !== 'sent') {
    const pushResult = await pushInvoiceSentToRemote(event);
    if (!pushResult?.ok) return pushResult;
    state = await getInvoiceState({ businessId, invoiceId });
    verifyMode = 'push-verify';
  }

  if (!state) {
    return reject('Factura no encontrada en remoto tras sent', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  if (state.status !== 'sent') {
    return reject('Estado de factura no coincide tras sent', {
      invoice_id: invoiceId,
      expected_status: 'sent',
      current_status: state.status || null
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      invoice_id: state.id,
      status: state.status,
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

async function verifyInvoiceCancel(event) {
  const businessId = normalizeText(event?.business_id);
  const invoiceId = normalizeText(event?.payload?.invoice_id);

  if (!businessId || !invoiceId) {
    return reject('Mutación invoice.cancel sin identificadores', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  let state = await getInvoiceState({ businessId, invoiceId });
  let verifyMode = 'verify';
  if (!state || state.status !== 'cancelled') {
    const pushResult = await pushInvoiceCancelToRemote(event);
    if (!pushResult?.ok) return pushResult;
    state = await getInvoiceState({ businessId, invoiceId });
    verifyMode = 'push-verify';
  }

  if (!state) {
    return reject('Factura no encontrada en remoto tras cancel', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  if (state.status !== 'cancelled') {
    return reject('Estado de factura no coincide tras cancel', {
      invoice_id: invoiceId,
      expected_status: 'cancelled',
      current_status: state.status || null
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      invoice_id: state.id,
      status: state.status,
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

async function verifyInvoiceDelete(event) {
  const businessId = normalizeText(event?.business_id);
  const invoiceId = normalizeText(event?.payload?.invoice_id);

  if (!businessId || !invoiceId) {
    return reject('Mutación invoice.delete sin identificadores', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  let state = await getInvoiceState({ businessId, invoiceId });
  let verifyMode = 'verify';
  if (state) {
    const pushResult = await pushInvoiceDeleteToRemote(event);
    if (!pushResult?.ok) return pushResult;
    verifyMode = 'push-verify';
    state = await getInvoiceState({ businessId, invoiceId });
  }

  if (state) {
    return reject('Factura sigue presente en remoto tras delete', {
      business_id: businessId,
      invoice_id: invoiceId
    });
  }

  return {
    ok: true,
    ackPayload: ackPayload(event, verifyMode, {
      invoice_id: invoiceId,
      deleted_remote: true,
      pushed_to_remote: verifyMode === 'push-verify'
    })
  };
}

export function createVerificationHandlers() {
  return {
    'sale.create': verifySaleCreate,
    'sale.delete': verifySaleDelete,
    'purchase.create': verifyPurchaseCreate,
    'purchase.delete': verifyPurchaseDelete,
    'table.create': verifyTableCreate,
    'table.delete_cascade_orders': verifyTableDeleteCascadeOrders,
    'order.create': verifyOrderCreate,
    'order.total.update': verifyOrderTotalUpdate,
    'order.item.insert': verifyOrderItemInsert,
    'order.item.update_quantity': verifyOrderItemUpdateQuantity,
    'order.item.bulk_quantity_update': verifyOrderItemBulkQuantityUpdate,
    'order.item.delete': verifyOrderItemDelete,
    'order.delete_and_release_table': verifyOrderDeleteAndReleaseTable,
    'order.close.single': verifyOrderCloseSingle,
    'order.close.split': verifyOrderCloseSplit,
    'product.create': verifyProductCreate,
    'product.update': verifyProductUpdate,
    'product.status.update': verifyProductUpdate,
    'product.delete': verifyProductDelete,
    'supplier.create': verifySupplierCreate,
    'supplier.update': verifySupplierUpdate,
    'supplier.delete': verifySupplierDelete,
    'invoice.create': verifyInvoiceCreate,
    'invoice.sent': verifyInvoiceSent,
    'invoice.cancel': verifyInvoiceCancel,
    'invoice.delete': verifyInvoiceDelete
  };
}

export default createVerificationHandlers;
