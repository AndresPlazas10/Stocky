import { getSupabaseClient } from '../lib/supabase';
import { notifyAdminLowStock, notifyAdminSaleRegistered } from '../notifications/mobileNotificationsService';
import {
  listCatalogItems,
  type ListCatalogItemsOptions,
  type MesaOrderCatalogItem,
} from './mesaOrderService';
import type { CashChangeEntry, PaymentMethod } from './mesaCheckoutService';

export type VentaRecord = {
  id: string;
  business_id: string;
  user_id: string | null;
  seller_name: string;
  payment_method: PaymentMethod;
  total: number;
  created_at: string | null;
  amount_received: number | null;
  change_amount: number | null;
  change_breakdown: CashChangeEntry[];
};

export type VentaDetailRecord = {
  id: string;
  sale_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product_id: string | null;
  combo_id: string | null;
  products?: {
    name?: string;
    code?: string;
  } | null;
  combos?: {
    nombre?: string;
  } | null;
};

export type VentaCartItem = {
  id: string;
  item_type: 'product' | 'combo';
  product_id: string | null;
  combo_id: string | null;
  name: string;
  code: string | null;
  manage_stock?: boolean;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type SellerContext = {
  userId: string;
  sellerName: string;
  isEmployee: boolean;
};

const SELLER_CONTEXT_CACHE_TTL_MS = 60_000;
const DEFAULT_SALES_HISTORY_CACHE_TTL_MS = 15_000;
const DEFAULT_FIRST_VENTA_DAY_CACHE_TTL_MS = 5 * 60_000;
const sellerContextCacheByKey = new Map<string, {
  value: SellerContext;
  expiresAt: number;
}>();
const sellerContextInFlightByKey = new Map<string, Promise<SellerContext>>();
const salesHistoryCacheByKey = new Map<string, {
  items: VentaRecord[];
  cachedAt: number;
}>();
const salesHistoryInFlightByKey = new Map<string, Promise<VentaRecord[]>>();
const firstVentaDayCacheByBusinessId = new Map<string, {
  dayKey: string | null;
  cachedAt: number;
}>();
const firstVentaDayInFlightByBusinessId = new Map<string, Promise<string | null>>();
let recentSalesRpcCompatibility: 'unknown' | 'supported' | 'unsupported' = 'unknown';

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFunctionUnavailableError(errorLike: any, functionName: string) {
  const message = String(errorLike?.message || '').toLowerCase();
  if (!message) return false;

  return message.includes(String(functionName || '').toLowerCase())
    && (
      message.includes('does not exist')
      || message.includes('could not find the function')
      || message.includes('schema cache')
      || message.includes('pgrst202')
      || message.includes('not found')
    );
}

function isMissingColumnError(
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

function isMissingListRecentSalesMobileRpcError(errorLike: any) {
  const code = String(errorLike?.code || '').toLowerCase();
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    code === 'pgrst202'
    || code === '42883'
    || (
      message.includes('list_recent_sales_mobile')
      && (
        message.includes('does not exist')
        || message.includes('could not find the function')
        || message.includes('schema cache')
        || message.includes('not found')
      )
    )
  );
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

function buildIdempotencyKey({
  businessId,
  seed,
}: {
  businessId: string;
  seed: string;
}) {
  return `stocky:mobile:sale:${businessId}:${seed}`;
}

function buildSalesHistoryCacheKey(businessId: string, limit: number) {
  return `${normalizeText(businessId)}::${Math.max(1, Math.floor(Number(limit) || 0))}`;
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

function normalizeCashBreakdown(breakdown: CashChangeEntry[] | null | undefined) {
  return (Array.isArray(breakdown) ? breakdown : [])
    .map((entry) => ({
      denomination: Math.round(normalizeNumber(entry?.denomination, 0)),
      count: Math.round(normalizeNumber(entry?.count, 0)),
    }))
    .filter((entry) => entry.denomination > 0 && entry.count > 0);
}

async function resolveSellerContext(businessId: string) {
  const normalizedBusinessId = normalizeText(businessId);
  if (!normalizedBusinessId) throw new Error('Negocio invalido');

  const client = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) throw userError;
  if (!user?.id) throw new Error('Sesión no válida');
  const cacheKey = `${normalizedBusinessId}::${normalizeText(user.id)}`;

  const cached = sellerContextCacheByKey.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inFlight = sellerContextInFlightByKey.get(cacheKey);
  if (inFlight) return inFlight;

  const resolver = (async (): Promise<SellerContext> => {
    const [employeeResult, businessResult] = await Promise.all([
      client
        .from('employees')
        .select('full_name, role')
        .eq('user_id', user.id)
        .eq('business_id', normalizedBusinessId)
        .eq('is_active', true)
        .maybeSingle(),
      client
        .from('businesses')
        .select('created_by')
        .eq('id', normalizedBusinessId)
        .maybeSingle(),
    ]);

    if (employeeResult.error) throw employeeResult.error;
    if (businessResult.error) throw businessResult.error;

    const isOwner = normalizeReference(businessResult.data?.created_by) === normalizeReference(user.id);
    const isAdmin = isAdminRole(employeeResult.data?.role);
    const employeeName = normalizeReference(employeeResult.data?.full_name);
    const userDisplayName = resolveUserDisplayName(user);

    const isEmployee = !isOwner && !isAdmin;
    return {
      userId: user.id,
      sellerName: isOwner || isAdmin
        ? 'Administrador'
        : (employeeName || userDisplayName || 'Vendedor'),
      isEmployee,
    };
  })();

  sellerContextInFlightByKey.set(cacheKey, resolver);

  try {
    const resolved = await resolver;
    sellerContextCacheByKey.set(cacheKey, {
      value: resolved,
      expiresAt: Date.now() + SELLER_CONTEXT_CACHE_TTL_MS,
    });
    return resolved;
  } finally {
    sellerContextInFlightByKey.delete(cacheKey);
  }
}

function normalizeVentaRecord(row: any): VentaRecord {
  const paymentMethod = normalizeText(row?.payment_method).toLowerCase();
  const safeMethod: PaymentMethod = paymentMethod === 'card'
    || paymentMethod === 'transfer'
    || paymentMethod === 'mixed'
    ? paymentMethod
    : 'cash';

  return {
    id: normalizeText(row?.id),
    business_id: normalizeText(row?.business_id),
    user_id: normalizeReference(row?.user_id),
    seller_name: normalizeText(row?.seller_name) || 'Vendedor',
    payment_method: safeMethod,
    total: normalizeNumber(row?.total, 0),
    created_at: normalizeReference(row?.created_at),
    amount_received: row?.amount_received === null ? null : normalizeNumber(row?.amount_received, 0),
    change_amount: row?.change_amount === null ? null : normalizeNumber(row?.change_amount, 0),
    change_breakdown: normalizeCashBreakdown(row?.change_breakdown),
  };
}

function normalizeVentaDetailRecord(row: any): VentaDetailRecord {
  return {
    id: normalizeText(row?.id),
    sale_id: normalizeText(row?.sale_id),
    quantity: normalizeNumber(row?.quantity, 0),
    unit_price: normalizeNumber(row?.unit_price, 0),
    subtotal: normalizeNumber(row?.subtotal, normalizeNumber(row?.quantity, 0) * normalizeNumber(row?.unit_price, 0)),
    product_id: normalizeReference(row?.product_id),
    combo_id: normalizeReference(row?.combo_id),
    products: row?.products
      ? {
          name: row.products.name ? String(row.products.name) : undefined,
          code: row.products.code ? String(row.products.code) : undefined,
        }
      : null,
    combos: row?.combos
      ? {
          nombre: row.combos.nombre ? String(row.combos.nombre) : undefined,
        }
      : null,
  };
}

function normalizeRpcCartItems(items: VentaCartItem[]) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const productId = normalizeReference(item?.product_id);
    const comboId = normalizeReference(item?.combo_id);
    const quantity = normalizeNumber(item?.quantity, NaN);
    const unitPrice = normalizeNumber(item?.unit_price, NaN);

    if ((!productId && !comboId) || (productId && comboId)) {
      throw new Error('Item invalido en carrito.');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Cantidad invalida para ${item?.name || 'item'}.`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Precio invalido para ${item?.name || 'item'}.`);
    }

    return {
      product_id: productId,
      combo_id: comboId,
      quantity,
      unit_price: unitPrice,
    };
  });
}

export async function listVentasCatalog(
  businessId: string,
  options?: ListCatalogItemsOptions,
): Promise<MesaOrderCatalogItem[]> {
  return listCatalogItems(businessId, options);
}

export function invalidateVentasHistoryCache(businessId?: string) {
  const normalizedBusinessId = normalizeText(businessId);
  if (normalizedBusinessId) {
    Array.from(salesHistoryCacheByKey.keys()).forEach((key) => {
      if (key.startsWith(`${normalizedBusinessId}::`)) {
        salesHistoryCacheByKey.delete(key);
      }
    });
    Array.from(salesHistoryInFlightByKey.keys()).forEach((key) => {
      if (key.startsWith(`${normalizedBusinessId}::`)) {
        salesHistoryInFlightByKey.delete(key);
      }
    });
    firstVentaDayCacheByBusinessId.delete(normalizedBusinessId);
    firstVentaDayInFlightByBusinessId.delete(normalizedBusinessId);
    return;
  }

  salesHistoryCacheByKey.clear();
  salesHistoryInFlightByKey.clear();
  firstVentaDayCacheByBusinessId.clear();
  firstVentaDayInFlightByBusinessId.clear();
}

export async function getFirstVentaDayKey(
  businessId: string,
  options?: {
    forceRefresh?: boolean;
    ttlMs?: number;
  },
): Promise<string | null> {
  const normalizedBusinessId = normalizeText(businessId);
  if (!normalizedBusinessId) return null;
  const forceRefresh = options?.forceRefresh === true;
  const ttlMs = Number.isFinite(Number(options?.ttlMs))
    ? Math.max(0, Number(options?.ttlMs))
    : DEFAULT_FIRST_VENTA_DAY_CACHE_TTL_MS;

  if (!forceRefresh) {
    const cached = firstVentaDayCacheByBusinessId.get(normalizedBusinessId);
    if (cached && (Date.now() - cached.cachedAt) <= ttlMs) return cached.dayKey;
  }

  const inFlight = firstVentaDayInFlightByBusinessId.get(normalizedBusinessId);
  if (inFlight) return inFlight;

  const request = (async () => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('sales')
    .select('created_at')
    .eq('business_id', normalizedBusinessId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const rawDate = normalizeReference(data?.created_at);
  if (!rawDate) {
    firstVentaDayCacheByBusinessId.set(normalizedBusinessId, {
      dayKey: null,
      cachedAt: Date.now(),
    });
    return null;
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    firstVentaDayCacheByBusinessId.set(normalizedBusinessId, {
      dayKey: null,
      cachedAt: Date.now(),
    });
    return null;
  }

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  const dayKey = `${year}-${month}-${day}`;
  firstVentaDayCacheByBusinessId.set(normalizedBusinessId, {
    dayKey,
    cachedAt: Date.now(),
  });
  return dayKey;
  })();

  firstVentaDayInFlightByBusinessId.set(normalizedBusinessId, request);

  try {
    return await request;
  } finally {
    firstVentaDayInFlightByBusinessId.delete(normalizedBusinessId);
  }
}

export async function listRecentVentas(
  businessId: string,
  limit = 40,
  options?: {
    forceRefresh?: boolean;
    ttlMs?: number;
  },
): Promise<VentaRecord[]> {
  const normalizedBusinessId = normalizeText(businessId);
  if (!normalizedBusinessId) return [];
  const normalizedLimit = Math.max(1, Math.floor(Number(limit) || 40));
  const forceRefresh = options?.forceRefresh === true;
  const ttlMs = Number.isFinite(Number(options?.ttlMs))
    ? Math.max(0, Number(options?.ttlMs))
    : DEFAULT_SALES_HISTORY_CACHE_TTL_MS;
  const cacheKey = buildSalesHistoryCacheKey(normalizedBusinessId, normalizedLimit);

  if (!forceRefresh) {
    const cached = salesHistoryCacheByKey.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt) <= ttlMs) return cached.items;
  }

  const inFlight = salesHistoryInFlightByKey.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const client = getSupabaseClient();
    const fullSelect = 'id,business_id,user_id,seller_name,payment_method,total,created_at,amount_received,change_amount,change_breakdown';
    const fallbackSelect = 'id,business_id,user_id,seller_name,payment_method,total,created_at';

    if (recentSalesRpcCompatibility !== 'unsupported') {
      const rpcResult = await client.rpc('list_recent_sales_mobile', {
        p_business_id: normalizedBusinessId,
        p_limit: normalizedLimit,
      });

      if (!rpcResult.error) {
        recentSalesRpcCompatibility = 'supported';
        const normalizedRpc = (Array.isArray(rpcResult.data) ? rpcResult.data : []).map(normalizeVentaRecord);
        salesHistoryCacheByKey.set(cacheKey, {
          items: normalizedRpc,
          cachedAt: Date.now(),
        });
        return normalizedRpc;
      }

      if (isMissingListRecentSalesMobileRpcError(rpcResult.error)) {
        recentSalesRpcCompatibility = 'unsupported';
      } else {
        throw rpcResult.error;
      }
    }

    const full = await client
      .from('sales')
      .select(fullSelect)
      .eq('business_id', normalizedBusinessId)
      .order('created_at', { ascending: false })
      .limit(normalizedLimit);

    if (!full.error) {
      const normalized = (Array.isArray(full.data) ? full.data : []).map(normalizeVentaRecord);
      salesHistoryCacheByKey.set(cacheKey, {
        items: normalized,
        cachedAt: Date.now(),
      });
      return normalized;
    }

    if (isMissingColumnError(full.error, { tableName: 'sales', columnName: 'amount_received' })
      || isMissingColumnError(full.error, { tableName: 'sales', columnName: 'change_amount' })
      || isMissingColumnError(full.error, { tableName: 'sales', columnName: 'change_breakdown' })) {
      const fallback = await client
        .from('sales')
        .select(fallbackSelect)
        .eq('business_id', normalizedBusinessId)
        .order('created_at', { ascending: false })
        .limit(normalizedLimit);

      if (fallback.error) throw fallback.error;
      const normalized = (Array.isArray(fallback.data) ? fallback.data : []).map(normalizeVentaRecord);
      salesHistoryCacheByKey.set(cacheKey, {
        items: normalized,
        cachedAt: Date.now(),
      });
      return normalized;
    }

    throw full.error;
  })();

  salesHistoryInFlightByKey.set(cacheKey, request);

  try {
    return await request;
  } finally {
    salesHistoryInFlightByKey.delete(cacheKey);
  }
}

export async function listVentaDetails(saleId: string): Promise<VentaDetailRecord[]> {
  const client = getSupabaseClient();
  const pageSize = 200;
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let from = 0;
    let hasMore = true;
    const rows: any[] = [];

    try {
      while (hasMore) {
        const to = from + pageSize - 1;
        const batch = await client
          .from('sale_details')
          .select('id,sale_id,quantity,unit_price,subtotal,product_id,combo_id,products(name,code),combos(nombre)')
          .eq('sale_id', saleId)
          .order('id', { ascending: true })
          .range(from, to);

        if (batch.error) throw batch.error;

        const data = Array.isArray(batch.data) ? batch.data : [];
        rows.push(...data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      }

      return rows.map(normalizeVentaDetailRecord);
    } catch (err) {
      if (attempt >= maxAttempts) {
        throw err;
      }
      const backoffMs = Math.min(1600, 200 * 2 ** (attempt - 1));
      await sleep(backoffMs);
    }
  }

  return [];
}

export async function createVenta({
  businessId,
  cartItems,
  paymentMethod = 'cash',
  amountReceived = null,
  changeBreakdown = [],
  idempotencySeed = '',
}: {
  businessId: string;
  cartItems: VentaCartItem[];
  paymentMethod?: PaymentMethod;
  amountReceived?: number | null;
  changeBreakdown?: CashChangeEntry[] | null;
  idempotencySeed?: string;
}): Promise<{ saleId: string | null; total: number }> {
  const itemsForRpc = normalizeRpcCartItems(cartItems);
  if (itemsForRpc.length === 0) {
    throw new Error('El carrito esta vacio.');
  }

  const saleTotal = itemsForRpc.reduce(
    (sum, item) => sum + (normalizeNumber(item.quantity, 0) * normalizeNumber(item.unit_price, 0)),
    0,
  );
  const hasComboItems = itemsForRpc.some((item) => Boolean(item.combo_id));
  const { userId, sellerName, isEmployee } = await resolveSellerContext(businessId);
  const idempotencyKey = buildIdempotencyKey({
    businessId,
    seed: idempotencySeed || `${Date.now()}`,
  });

  const normalizedAmountReceived = Number.isFinite(Number(amountReceived))
    ? Number(amountReceived)
    : null;
  const normalizedChangeBreakdown = normalizeCashBreakdown(changeBreakdown || []);

  const client = getSupabaseClient();
  const basePayload = {
    p_business_id: businessId,
    p_user_id: userId,
    p_seller_name: sellerName,
    p_payment_method: paymentMethod,
    p_items: itemsForRpc,
    p_order_id: null,
    p_table_id: null,
    p_amount_received: normalizedAmountReceived,
    p_change_breakdown: normalizedChangeBreakdown,
  };
  const idempotentPayload = {
    ...basePayload,
    p_idempotency_key: idempotencyKey,
  };

  let rpcData: any = null;
  let rpcError: any = null;

  if (hasComboItems) {
    ({ data: rpcData, error: rpcError } = await client.rpc('create_sale_complete', basePayload));
    if (rpcError && isFunctionUnavailableError(rpcError, 'create_sale_complete')) {
      ({ data: rpcData, error: rpcError } = await client.rpc('create_sale_complete_idempotent', idempotentPayload));
    }
  } else {
    ({ data: rpcData, error: rpcError } = await client.rpc('create_sale_complete_idempotent', idempotentPayload));
    if (rpcError && isFunctionUnavailableError(rpcError, 'create_sale_complete_idempotent')) {
      ({ data: rpcData, error: rpcError } = await client.rpc('create_sale_complete', basePayload));
    }
  }

  if (rpcError) {
    throw new Error(rpcError.message || 'Error al crear venta');
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!row || (row.status && String(row.status).toLowerCase() !== 'success')) {
    throw new Error('Respuesta invalida al crear venta.');
  }

  const saleId = normalizeReference(row.sale_id);

  if (saleId && paymentMethod === 'cash') {
    // Best-effort de metadatos de efectivo.
    await client
      .from('sales')
      .update({
        amount_received: normalizedAmountReceived,
        change_amount: normalizedAmountReceived !== null ? Math.max(normalizedAmountReceived - saleTotal, 0) : null,
        change_breakdown: normalizedChangeBreakdown,
      })
      .eq('id', saleId)
      .eq('business_id', businessId);
  }

  const resolvedTotal = normalizeNumber(row.total_amount, saleTotal);

  invalidateVentasHistoryCache(businessId);

  if (saleId) {
    const accessToken = await resolveAccessToken();
    if (accessToken && isEmployee) {
      void notifyAdminSaleRegistered({
        accessToken,
        businessId,
        saleTotal: resolvedTotal,
      });
    }

    const lowStockProductIds = Array.from(
      new Set(
        (Array.isArray(cartItems) ? cartItems : [])
          .filter((item) => item?.manage_stock !== false)
          .map((item) => normalizeReference(item?.product_id))
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

  return {
    saleId,
    total: resolvedTotal,
  };
}

export async function deleteVentaWithDetails({
  saleId,
  businessId,
}: {
  saleId: string;
  businessId: string;
}): Promise<void> {
  const client = getSupabaseClient();

  const deleteDetails = await client
    .from('sale_details')
    .delete()
    .eq('sale_id', saleId);

  if (deleteDetails.error) {
    throw deleteDetails.error;
  }

  const deleteSale = await client
    .from('sales')
    .delete()
    .eq('id', saleId)
    .eq('business_id', businessId);

  if (deleteSale.error) {
    throw deleteSale.error;
  }

  invalidateVentasHistoryCache(businessId);
}
