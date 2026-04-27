import { getSupabaseClient } from '../lib/supabase';
import { notifyAdminLowStock, notifyAdminSaleRegistered } from '../notifications/mobileNotificationsService';
import type { MesaOrderItem } from './mesaOrderService';

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'transfer'
  | 'mixed'
  | 'nequi'
  | 'bancolombia'
  | 'banco_bogota'
  | 'nu'
  | 'davivienda';

export type CashChangeEntry = {
  denomination: number;
  count: number;
};

export type SplitSubAccountItem = {
  product_id?: string | null;
  combo_id?: string | null;
  quantity: number;
  price?: number;
  unit_price?: number;
};

export type SplitSubAccount = {
  name: string;
  paymentMethod: PaymentMethod;
  amountReceived?: number | null;
  changeBreakdown?: CashChangeEntry[] | null;
  items: SplitSubAccountItem[];
  total?: number;
};

// Prioriza cierre atómico (más rápido). Si falla, se usa fallback secuencial.
const ENABLE_ATOMIC_SPLIT_CLOSE = true;
const SELLER_CONTEXT_TTL_MS = 5 * 60 * 1000;
const sellerContextCache = new Map<string, {
  userId: string;
  sellerName: string;
  isEmployee: boolean;
  expiresAt: number;
}>();

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeForMatch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeReference(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return normalized;
}

function buildIdempotencyKey({
  action,
  businessId,
  orderId,
  tableId,
}: {
  action: string;
  businessId: string;
  orderId: string | null;
  tableId: string | null;
}) {
  return `stocky:mobile:${action}:${businessId}:${orderId || 'none'}:${tableId || 'none'}`;
}

function isFunctionUnavailableError(errorLike: any, functionName: string) {
  const message = normalizeForMatch(errorLike?.message || '');
  if (!message) return false;

  return message.includes(normalizeForMatch(functionName || ''))
    && (
      message.includes('does not exist')
      || message.includes('could not find the function')
      || message.includes('schema cache')
      || message.includes('pgrst202')
      || message.includes('not found')
    );
}

function isOrderContextError(errorLike: any) {
  const message = normalizeForMatch(errorLike?.message || '');
  return (
    (message.includes('la orden') && message.includes('no esta abierta'))
    || (message.includes('la mesa') && message.includes('no esta asociada'))
    || (message.includes('cambio durante el cierre') || message.includes('cambio durante cierre'))
    || (message.includes('order') && message.includes('not found'))
    || (message.includes('table') && message.includes('not found'))
  );
}

function isMissingColumnInRelationError(
  errorLike: any,
  { tableName, columnName }: { tableName: string; columnName: string },
) {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('column')
    && message.includes(`"${String(columnName || '').toLowerCase()}"`)
    && message.includes('relation')
    && message.includes(`"${String(tableName || '').toLowerCase()}"`)
    && message.includes('does not exist')
  );
}

function pickFirstRow(data: any) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function isAdminRole(roleLike: unknown) {
  const role = normalizeText(roleLike).toLowerCase();
  return role === 'owner'
    || role === 'admin'
    || role === 'administrador'
    || role === 'propietario'
    || role.includes('admin');
}

function resolveUserDisplayName(user: any): string | null {
  if (!user || typeof user !== 'object') return null;
  const metadata = user?.user_metadata && typeof user.user_metadata === 'object'
    ? user.user_metadata
    : {};
  const candidates = [
    metadata?.full_name,
    metadata?.name,
    metadata?.display_name,
    user?.full_name,
    user?.email,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeReference(candidate);
    if (normalized) return normalized;
  }

  return null;
}

async function getUserAndSellerName(businessId: string) {
  const client = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) throw userError;
  if (!user?.id) throw new Error('No se pudo obtener la sesión activa.');

  const cacheKey = `${businessId}:${user.id}`;
  const now = Date.now();
  const cached = sellerContextCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return { userId: cached.userId, sellerName: cached.sellerName, isEmployee: cached.isEmployee };
  }

  const [employeeResult, businessResult] = await Promise.all([
    client
      .from('employees')
      .select('full_name, role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle(),
    client
      .from('businesses')
      .select('created_by')
      .eq('id', businessId)
      .maybeSingle(),
  ]);

  if (employeeResult.error) throw employeeResult.error;
  if (businessResult.error) throw businessResult.error;

  const isOwner = normalizeReference(businessResult.data?.created_by) === normalizeReference(user.id);
  const isAdmin = isAdminRole(employeeResult.data?.role);
  const employeeName = normalizeReference(employeeResult.data?.full_name);
  const userDisplay = resolveUserDisplayName(user);

  const sellerName = isOwner || isAdmin
    ? 'Administrador'
    : (employeeName || userDisplay || 'Empleado');
  const isEmployee = !isOwner && !isAdmin;

  sellerContextCache.set(cacheKey, {
    userId: user.id,
    sellerName,
    isEmployee,
    expiresAt: now + SELLER_CONTEXT_TTL_MS,
  });

  return { userId: user.id, sellerName, isEmployee };
}

async function resolveAccessToken(): Promise<string | null> {
  const client = getSupabaseClient();
  const {
    data: { session },
    error,
  } = await client.auth.getSession();
  if (error) return null;
  return session?.access_token ? String(session.access_token) : null;
}

function normalizeOrderItemsForSale(orderItems: Array<{
  product_id?: string | null;
  combo_id?: string | null;
  quantity?: number;
  price?: number;
  unit_price?: number;
}>) {
  const source = Array.isArray(orderItems) ? orderItems : [];

  return source.map((item) => {
    const productId = normalizeReference(item?.product_id);
    const comboId = normalizeReference(item?.combo_id);
    const quantity = normalizeNumber(item?.quantity, NaN);
    const unitPrice = normalizeNumber(item?.unit_price ?? item?.price, NaN);

    if ((!productId && !comboId) || (productId && comboId)) {
      throw new Error('La orden tiene items invalidos.');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('La orden tiene cantidades invalidas.');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('La orden tiene precios invalidos.');
    }

    return {
      product_id: productId,
      combo_id: comboId,
      quantity,
      unit_price: unitPrice,
    };
  });
}

async function callCreateSaleCompleteWithFallback({
  preferBase = false,
  baseParams,
  idempotentParams,
}: {
  preferBase?: boolean;
  baseParams: Record<string, any>;
  idempotentParams: Record<string, any>;
}) {
  const client = getSupabaseClient();

  if (preferBase) {
    let { data, error } = await client.rpc('create_sale_complete', baseParams);
    if (error && isFunctionUnavailableError(error, 'create_sale_complete')) {
      ({ data, error } = await client.rpc('create_sale_complete_idempotent', idempotentParams));
    }
    return { row: pickFirstRow(data), error };
  }

  let { data, error } = await client.rpc('create_sale_complete_idempotent', idempotentParams);
  if (error && isFunctionUnavailableError(error, 'create_sale_complete_idempotent')) {
    ({ data, error } = await client.rpc('create_sale_complete', baseParams));
  }

  return { row: pickFirstRow(data), error };
}

async function callCreateSplitSalesCompleteWithFallback({
  baseParams,
  idempotentParams,
}: {
  baseParams: Record<string, any>;
  idempotentParams: Record<string, any>;
}) {
  const client = getSupabaseClient();

  let { data, error } = await client.rpc('create_split_sales_complete_idempotent', idempotentParams);
  if (error && isFunctionUnavailableError(error, 'create_split_sales_complete_idempotent')) {
    ({ data, error } = await client.rpc('create_split_sales_complete', baseParams));
  }

  if (error && isFunctionUnavailableError(error, 'create_split_sales_complete')) {
    ({ data, error } = await client.rpc('create_split_sales_complete', baseParams));
  }

  return { row: pickFirstRow(data), error };
}

async function finalizeOrderAndTable({
  businessId,
  orderId,
  tableId,
}: {
  businessId: string;
  orderId: string | null;
  tableId: string | null;
}) {
  const client = getSupabaseClient();

  if (orderId) {
    const closeWithTimestamp = await client
      .from('orders')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('business_id', businessId);

    if (closeWithTimestamp.error && !isMissingColumnInRelationError(closeWithTimestamp.error, {
      tableName: 'orders',
      columnName: 'closed_at',
    })) {
      throw closeWithTimestamp.error;
    }

    if (closeWithTimestamp.error) {
      const closeFallback = await client
        .from('orders')
        .update({ status: 'closed' })
        .eq('id', orderId)
        .eq('business_id', businessId);

      if (closeFallback.error) throw closeFallback.error;
    }
  }

  if (tableId) {
    const release = await client
      .from('tables')
      .update({
        current_order_id: null,
        status: 'available',
      })
      .eq('id', tableId)
      .eq('business_id', businessId);

    if (release.error) throw release.error;
  }
}

function normalizeCashChangeBreakdown(changeBreakdown: CashChangeEntry[] | null | undefined) {
  const source = Array.isArray(changeBreakdown) ? changeBreakdown : [];

  return source
    .map((entry) => ({
      denomination: Math.round(normalizeNumber(entry?.denomination, 0)),
      count: Math.round(normalizeNumber(entry?.count, 0)),
    }))
    .filter((entry) => entry.denomination > 0 && entry.count > 0);
}

function computeChangeFromBreakdown(changeBreakdown: Array<{ denomination: number; count: number }>) {
  return changeBreakdown.reduce((sum, entry) => sum + (entry.denomination * entry.count), 0);
}

async function persistSaleCashMetadata({
  businessId,
  saleId,
  paymentMethod,
  saleTotal,
  amountReceived,
  changeBreakdown,
}: {
  businessId: string;
  saleId: string | null;
  paymentMethod: PaymentMethod;
  saleTotal: number;
  amountReceived: number | null;
  changeBreakdown: CashChangeEntry[] | null | undefined;
}) {
  if (!saleId || paymentMethod !== 'cash') return;

  const normalizedAmountReceived = Number.isFinite(Number(amountReceived))
    ? Math.max(Number(amountReceived), 0)
    : null;
  const normalizedBreakdown = normalizeCashChangeBreakdown(changeBreakdown);
  const breakdownChange = computeChangeFromBreakdown(normalizedBreakdown);
  const changeAmount = breakdownChange > 0
    ? breakdownChange
    : (normalizedAmountReceived !== null ? Math.max(normalizedAmountReceived - saleTotal, 0) : null);

  const client = getSupabaseClient();
  const result = await client
    .from('sales')
    .update({
      amount_received: normalizedAmountReceived,
      change_amount: changeAmount,
      change_breakdown: normalizedBreakdown,
    })
    .eq('id', saleId)
    .eq('business_id', businessId);

  if (result.error) {
    // Best effort: no bloquear cierre de mesa por metadata de efectivo.
  }
}

export async function closeOrderSingle({
  businessId,
  orderId,
  tableId,
  paymentMethod,
  amountReceived = null,
  changeBreakdown = null,
  orderItems,
}: {
  businessId: string;
  orderId: string;
  tableId: string;
  paymentMethod: PaymentMethod;
  amountReceived?: number | null;
  changeBreakdown?: CashChangeEntry[] | null;
  orderItems: MesaOrderItem[];
}): Promise<{ saleTotal: number; saleId: string | null }> {
  const normalizedItems = normalizeOrderItemsForSale(orderItems);
  if (normalizedItems.length === 0) {
    throw new Error('No hay productos en la orden para cerrar.');
  }

  const saleTotal = normalizedItems.reduce(
    (sum, item) => sum + (normalizeNumber(item.quantity, 0) * normalizeNumber(item.unit_price, 0)),
    0,
  );

  const { userId, sellerName, isEmployee } = await getUserAndSellerName(businessId);
  const idempotencyKey = buildIdempotencyKey({
    action: 'close-order-single',
    businessId,
    orderId,
    tableId,
  });

  const baseParams = {
    p_business_id: businessId,
    p_user_id: userId,
    p_seller_name: sellerName,
    p_payment_method: paymentMethod || 'cash',
    p_items: normalizedItems,
    p_order_id: orderId,
    p_table_id: tableId,
  };

  const idempotentParams = {
    ...baseParams,
    p_idempotency_key: idempotencyKey,
  };

  const preferBase = normalizedItems.some((item) => Boolean(item.combo_id));
  const firstAttempt = await callCreateSaleCompleteWithFallback({
    preferBase,
    baseParams,
    idempotentParams,
  });

  let resolvedRow = firstAttempt.row;
  let resolvedSaleId = normalizeReference(firstAttempt.row?.sale_id);

  if (firstAttempt.error || !resolvedRow) {
    if (!isOrderContextError(firstAttempt.error)) {
      throw new Error(firstAttempt.error?.message || 'No se pudo registrar la venta.');
    }

    const fallbackBaseParams = {
      ...baseParams,
      p_order_id: null,
      p_table_id: null,
    };
    const fallbackIdempotentParams = {
      ...idempotentParams,
      p_order_id: null,
      p_table_id: null,
      p_idempotency_key: `${idempotencyKey}:no-order-context`,
    };

    const fallbackAttempt = await callCreateSaleCompleteWithFallback({
      preferBase,
      baseParams: fallbackBaseParams,
      idempotentParams: fallbackIdempotentParams,
    });

    if (fallbackAttempt.error || !fallbackAttempt.row) {
      throw new Error(fallbackAttempt.error?.message || 'No se pudo registrar la venta.');
    }

    resolvedRow = fallbackAttempt.row;
    resolvedSaleId = normalizeReference(fallbackAttempt.row?.sale_id);
    await finalizeOrderAndTable({ businessId, orderId, tableId });
  }

  await persistSaleCashMetadata({
    businessId,
    saleId: resolvedSaleId,
    paymentMethod,
    saleTotal,
    amountReceived,
    changeBreakdown,
  });

  if (resolvedSaleId && saleTotal > 0) {
    const accessToken = await resolveAccessToken();
    if (accessToken && isEmployee) {
      void notifyAdminSaleRegistered({
        accessToken,
        businessId,
        saleTotal,
      });
    }

    const lowStockProductIds = Array.from(
      new Set(normalizedItems.map((item) => normalizeReference(item.product_id)).filter(Boolean)),
    );
    if (accessToken && lowStockProductIds.length > 0) {
      void notifyAdminLowStock({
        accessToken,
        businessId,
        productIds: lowStockProductIds as string[],
      });
    }
  }

  return {
    saleTotal,
    saleId: resolvedSaleId,
  };
}

export async function closeOrderAsSplit({
  businessId,
  orderId,
  tableId,
  subAccounts,
}: {
  businessId: string;
  orderId: string;
  tableId: string;
  subAccounts: SplitSubAccount[];
}): Promise<{ totalSold: number; saleIds: string[] }> {
  const normalizedSubAccounts = (Array.isArray(subAccounts) ? subAccounts : [])
    .map((sub, index) => {
      const normalizedItems = normalizeOrderItemsForSale(
        Array.isArray(sub?.items) ? sub.items : [],
      );

      return {
        name: normalizeText(sub?.name) || `Cuenta ${index + 1}`,
        paymentMethod: (normalizeText(sub?.paymentMethod).toLowerCase() || 'cash') as PaymentMethod,
        amountReceived: Number.isFinite(Number(sub?.amountReceived))
          ? Number(sub?.amountReceived)
          : null,
        changeBreakdown: normalizeCashChangeBreakdown(sub?.changeBreakdown || []),
        items: normalizedItems,
      };
    })
    .filter((sub) => sub.items.length > 0);

  if (normalizedSubAccounts.length === 0) {
    throw new Error('No hay subcuentas con productos validos para procesar.');
  }

  const { userId, sellerName, isEmployee } = await getUserAndSellerName(businessId);
  const idempotencyKey = buildIdempotencyKey({
    action: 'close-order-split',
    businessId,
    orderId,
    tableId,
  });

  if (ENABLE_ATOMIC_SPLIT_CLOSE) {
    const subAccountsForAtomicRpc = normalizedSubAccounts.map((sub) => ({
      name: sub.name,
      paymentMethod: sub.paymentMethod,
      payment_method: sub.paymentMethod,
      amountReceived: sub.amountReceived,
      amount_received: sub.amountReceived,
      changeBreakdown: sub.changeBreakdown,
      change_breakdown: sub.changeBreakdown,
      items: sub.items,
    }));

    const atomicBaseParams = {
      p_business_id: businessId,
      p_user_id: userId,
      p_seller_name: sellerName,
      p_sub_accounts: subAccountsForAtomicRpc,
      p_order_id: orderId,
      p_table_id: tableId,
    };
    const atomicIdempotentParams = {
      ...atomicBaseParams,
      p_idempotency_key: idempotencyKey,
    };

    const atomicAttempt = await callCreateSplitSalesCompleteWithFallback({
      baseParams: atomicBaseParams,
      idempotentParams: atomicIdempotentParams,
    });

    if (!atomicAttempt.error && atomicAttempt.row && normalizeText(atomicAttempt.row?.status).toLowerCase() === 'success') {
      const totalSold = normalizeNumber(atomicAttempt.row?.total_sold, 0);
      const saleIds = Array.isArray(atomicAttempt.row?.sale_ids)
        ? atomicAttempt.row.sale_ids.map((saleId: unknown) => normalizeText(saleId)).filter(Boolean)
        : [];

      if (totalSold > 0) {
        const accessToken = await resolveAccessToken();
        if (accessToken && isEmployee) {
          void notifyAdminSaleRegistered({
            accessToken,
            businessId,
            saleTotal: totalSold,
          });
        }
        const lowStockProductIds = Array.from(
          new Set(
            normalizedSubAccounts
              .flatMap((sub) => sub.items.map((item) => normalizeReference(item.product_id)))
              .filter(Boolean),
          ),
        );
        if (accessToken && lowStockProductIds.length > 0) {
          void notifyAdminLowStock({
            accessToken,
            businessId,
            productIds: lowStockProductIds as string[],
          });
        }
      }

      return { totalSold, saleIds };
    }
  }

  // Flujo secuencial principal (o fallback cuando la RPC atómica falla).
  let totalSold = 0;
  const saleIds: string[] = [];
  let shouldFinalizeOrderAndTable = false;

  for (let index = 0; index < normalizedSubAccounts.length; index += 1) {
    const sub = normalizedSubAccounts[index];
    const isLast = index === normalizedSubAccounts.length - 1;
    const subTotal = sub.items.reduce(
      (sum, item) => sum + (normalizeNumber(item.quantity, 0) * normalizeNumber(item.unit_price, 0)),
      0,
    );
    totalSold += subTotal;

    const useOrderContext = isLast;
    const subBaseParams = {
      p_business_id: businessId,
      p_user_id: userId,
      p_seller_name: sellerName,
      p_payment_method: sub.paymentMethod,
      p_items: sub.items,
      p_order_id: useOrderContext ? orderId : null,
      p_table_id: useOrderContext ? tableId : null,
    };
    const subIdempotentParams = {
      ...subBaseParams,
      p_idempotency_key: `${idempotencyKey}:sub:${index + 1}`,
    };

    const preferBase = sub.items.some((item) => Boolean(item.combo_id));
    let subAttempt = await callCreateSaleCompleteWithFallback({
      preferBase,
      baseParams: subBaseParams,
      idempotentParams: subIdempotentParams,
    });

    if ((subAttempt.error || !subAttempt.row) && useOrderContext && isOrderContextError(subAttempt.error)) {
      shouldFinalizeOrderAndTable = true;
      const withoutOrderContextBase = {
        ...subBaseParams,
        p_order_id: null,
        p_table_id: null,
      };
      const withoutOrderContextIdem = {
        ...subIdempotentParams,
        p_order_id: null,
        p_table_id: null,
        p_idempotency_key: `${idempotencyKey}:sub:${index + 1}:no-order-context`,
      };

      subAttempt = await callCreateSaleCompleteWithFallback({
        preferBase,
        baseParams: withoutOrderContextBase,
        idempotentParams: withoutOrderContextIdem,
      });
    }

    if (subAttempt.error || !subAttempt.row) {
      throw new Error(subAttempt.error?.message || `No se pudo registrar la venta ${index + 1}.`);
    }

    const saleId = normalizeReference(subAttempt.row?.sale_id);
    if (saleId) saleIds.push(saleId);

    await persistSaleCashMetadata({
      businessId,
      saleId,
      paymentMethod: sub.paymentMethod,
      saleTotal: subTotal,
      amountReceived: sub.amountReceived,
      changeBreakdown: sub.changeBreakdown,
    });
  }

  if (shouldFinalizeOrderAndTable) {
    await finalizeOrderAndTable({ businessId, orderId, tableId });
  }

  if (!Number.isFinite(totalSold) || totalSold <= 0) {
    throw new Error('No se pudieron generar ventas en el cierre dividido.');
  }

  if (totalSold > 0) {
    const accessToken = await resolveAccessToken();
    if (accessToken && isEmployee) {
      void notifyAdminSaleRegistered({
        accessToken,
        businessId,
        saleTotal: totalSold,
      });
    }
    const lowStockProductIds = Array.from(
      new Set(
        normalizedSubAccounts
          .flatMap((sub) => sub.items.map((item) => normalizeReference(item.product_id)))
          .filter(Boolean),
      ),
    );
    if (accessToken && lowStockProductIds.length > 0) {
      void notifyAdminLowStock({
        accessToken,
        businessId,
        productIds: lowStockProductIds as string[],
      });
    }
  }

  return { totalSold, saleIds };
}
