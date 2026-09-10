export function invalidatePurchaseCache(opts?: {
  businessId?: string | null;
  purchaseId?: string | null;
  supplierId?: string | null;
}): Promise<number>;

export function invalidateOrderCache(opts?: {
  businessId?: string | null;
  orderId?: string | null;
  tableId?: string | null;
  saleId?: string | null;
}): Promise<number>;

export function invalidateInventoryCache(opts?: {
  businessId?: string | null;
  productId?: string | null;
  supplierId?: string | null;
}): Promise<number>;

export function invalidateComboCache(opts?: {
  businessId?: string | null;
  comboId?: string | null;
}): Promise<number>;

export function invalidateInvoiceCache(opts?: {
  businessId?: string | null;
  invoiceId?: string | null;
}): Promise<number>;
