export function invalidateSaleCache(opts?: {
  businessId?: string | null;
  saleId?: string | null;
  employeeId?: string | null;
}): Promise<any>;

export function invalidatePurchaseCache(opts?: {
  businessId?: string | null;
  purchaseId?: string | null;
  supplierId?: string | null;
}): Promise<any>;

export function invalidateOrderCache(opts?: {
  businessId?: string | null;
  orderId?: string | null;
  tableId?: string | null;
  saleId?: string | null;
  releaseMesaSnapshot?: boolean;
}): Promise<any>;

export function invalidateInventoryCache(opts?: {
  businessId?: string | null;
  productId?: string | null;
  supplierId?: string | null;
}): Promise<any>;

export function invalidateComboCache(opts?: {
  businessId?: string | null;
  comboId?: string | null;
}): Promise<any>;

export function invalidateInvoiceCache(opts?: {
  businessId?: string | null;
  invoiceId?: string | null;
}): Promise<any>;

export function invalidateFromOutboxEvent(event?: Record<string, any>): Promise<any>;
