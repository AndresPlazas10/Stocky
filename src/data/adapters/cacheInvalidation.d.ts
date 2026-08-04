export function invalidateSaleCache(opts?: {
  businessId?: string | null;
  saleId?: string | null;
  employeeId?: string | null;
}): Promise<void>;

export function invalidatePurchaseCache(opts?: {
  businessId?: string | null;
  purchaseId?: string | null;
  supplierId?: string | null;
}): Promise<void>;

export function invalidateOrderCache(opts?: {
  businessId?: string | null;
  orderId?: string | null;
  tableId?: string | null;
  saleId?: string | null;
  releaseMesaSnapshot?: boolean;
}): Promise<void>;

export function invalidateInventoryCache(opts?: {
  businessId?: string | null;
  productId?: string | null;
  supplierId?: string | null;
}): Promise<void>;

export function invalidateComboCache(opts?: {
  businessId?: string | null;
  comboId?: string | null;
}): Promise<void>;

export function invalidateInvoiceCache(opts?: {
  businessId?: string | null;
  invoiceId?: string | null;
}): Promise<void>;

export function invalidateFromOutboxEvent(event?: Record<string, unknown>): Promise<void>;
