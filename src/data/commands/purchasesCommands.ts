import { supabaseAdapter } from '../adapters/supabaseAdapter';
import { invalidatePurchaseCache } from '../adapters/cacheInvalidation';
import type { Purchase } from '../../types';
import { isConnectivityError } from '../../utils/connectivity';

interface CartItem {
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  manage_stock?: boolean;
}

function normalizePurchasePaymentMethod(paymentMethod: string): string {
  const normalized = String(paymentMethod || '').trim().toLowerCase();
  if (!normalized) return 'cash';
  if (normalized === 'efectivo') return 'cash';
  if (normalized === 'tarjeta') return 'card';
  if (normalized === 'transferencia') return 'transfer';
  return normalized;
}

async function assertPurchasableProductsManageStock({
  businessId,
  cart = []
}: {
  businessId: string;
  cart: CartItem[];
}): Promise<void> {
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
    (productRows || []).map((product: { id: string; manage_stock?: boolean }) => [
      String(product.id),
      product.manage_stock !== false
    ])
  );

  const blockedIds = unknownIds.filter((id) => stockControlById.get(id) === false);
  if (blockedIds.length > 0) {
    throw new Error('No puedes registrar compras de productos sin control de stock.');
  }
}

function isMissingCreatePurchaseRpcError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();
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
}: {
  businessId: string;
  userId: string;
  supplierId: string | null;
  paymentMethod: string;
  notes: string | null;
  total: number;
  cart: CartItem[];
}): Promise<{ purchaseId: string }> {
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

  const stockMap = new Map((freshProducts || []).map((product: { id: string; stock?: number; manage_stock?: boolean }) => [
    product.id,
    {
      stock: Number(product.stock || 0),
      manage_stock: product.manage_stock !== false
    }
  ]));
  const purchaseItemMap = new Map(cart.map((item) => [item.product_id, item]));

  const updateResults = await Promise.all(
    productIds.map((productId) => {
      const item = purchaseItemMap.get(productId)!;
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

interface PurchaseRpcParams {
  businessId: string;
  userId: string;
  supplierId: string | null;
  paymentMethod: string;
  notes: string | null;
  total: number;
  cart: CartItem[];
  idempotencyKey?: string | null;
}

interface CreatePurchaseSuccessResult {
  success: true;
  data: {
    id: string | null;
    total: number;
    items_count: number;
    payment_method: string;
  };
}

interface CreatePurchaseFailureResult {
  success: false;
  error: string;
}

type CreatePurchaseResult = CreatePurchaseSuccessResult | CreatePurchaseFailureResult;

export async function createPurchaseWithRpcFallback({
  businessId,
  userId,
  supplierId,
  paymentMethod,
  notes,
  total,
  cart,
  idempotencyKey = null
}: PurchaseRpcParams): Promise<CreatePurchaseResult> {
  const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offlineMode) {
    return {
      success: false,
      error: 'Perdiste la conexión, intentando reconectar...'
    };
  }

  await assertPurchasableProductsManageStock({ businessId, cart });

  const purchaseItemsPayload = cart.map((item) => ({
    product_id: item.product_id,
    quantity: Number(item.quantity),
    unit_cost: Number(item.unit_price)
  }));
  const normalizedPaymentMethod = normalizePurchasePaymentMethod(paymentMethod);

  let rpcData: unknown = null;
  let rpcError: unknown = null;
  ({ data: rpcData, error: rpcError } = await supabaseAdapter.createPurchaseCompleteRpc({
    p_business_id: businessId,
    p_user_id: userId,
    p_supplier_id: supplierId,
    p_payment_method: normalizedPaymentMethod,
    p_notes: notes || null,
    p_items: purchaseItemsPayload
  }));

  let purchaseId: string | null = null;
  if (rpcError) {
    if (isConnectivityError(rpcError)) {
      return {
        success: false,
        error: 'Perdiste la conexión, intentando reconectar...'
      };
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
    purchaseId = (rpcRow as { purchase_id?: string })?.purchase_id || null;
  }

  await invalidatePurchaseCache({
    businessId,
    purchaseId,
    supplierId: supplierId || null
  });
  void idempotencyKey;

  return {
    success: true,
    data: {
      id: purchaseId,
      total: Number(total || 0),
      items_count: Number(cart?.length || 0),
      payment_method: normalizedPaymentMethod
    }
  };
}

interface DeletePurchaseResult {
  appliedManualFallback: boolean;
}

export async function deletePurchaseWithStockFallback({
  purchaseId,
  businessId
}: {
  purchaseId: string;
  businessId: string;
}): Promise<DeletePurchaseResult> {
  const { data: purchaseDetails, error: detailsFetchError } = await supabaseAdapter.getPurchaseDetailsByPurchaseId(
    purchaseId
  );
  if (detailsFetchError) throw new Error(`Error al consultar detalles: ${detailsFetchError.message}`);

  const groupedDetailsMap = new Map<string, number>();
  (purchaseDetails || []).forEach((detail: { product_id?: string; quantity?: number }) => {
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
  let stockBeforeMap = new Map<string, { stock: number; manage_stock: boolean }>();

  if (productIds.length > 0) {
    const { data: productsBefore, error: productsBeforeError } = await supabaseAdapter.getProductsByBusinessAndIds(
      businessId,
      productIds
    );
    if (productsBeforeError) throw new Error(`Error al consultar stock previo: ${productsBeforeError.message}`);
    stockBeforeMap = new Map((productsBefore || []).map((p: { id: string; stock?: number; manage_stock?: boolean }) => [
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

    const stockAfterMap = new Map((productsAfter || []).map((p: { id: string; stock?: number; manage_stock?: boolean }) => [
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
          stock: currentStock! - item.quantity,
          purchasePrice: undefined
        });
      });

      const fallbackResults = await Promise.all(fallbackUpdates);
      const fallbackError = fallbackResults.find((result) => result.error)?.error;
      if (fallbackError) throw new Error(`Error al ajustar stock manualmente: ${(fallbackError as Error).message}`);

      appliedManualFallback = true;
    }
  }

  await invalidatePurchaseCache({
    businessId,
    purchaseId
  });

  return { appliedManualFallback };
}
