import { readAdapter } from '../adapters/localAdapter';

export async function getTablesWithCurrentOrderByBusiness(businessId) {
  const { data, error } = await readAdapter.getTablesWithCurrentOrderByBusiness(businessId);
  if (error) throw error;
  return data || [];
}

export async function getOpenOrdersByBusiness(businessId, selectSql = 'id, business_id, table_id, status, opened_at, updated_at') {
  const { data, error } = await readAdapter.getOpenOrdersByBusiness(businessId, selectSql);
  if (error) throw error;
  return data || [];
}

export async function getProductsForOrdersByBusiness(businessId) {
  const { data, error } = await readAdapter.getProductsForOrdersByBusiness(businessId);
  if (error) throw error;
  return data || [];
}

export async function getOrderItemsByOrderId({ orderId, selectSql }) {
  const { data, error } = await readAdapter.getOrderItemsByOrderId(orderId, selectSql);
  if (error) throw error;
  return data || [];
}

export async function getOrderWithItemsById({ orderId, selectSql }) {
  const { data, error } = await readAdapter.getOrderWithItemsById(orderId, selectSql);
  if (error) throw error;
  return data || null;
}

export async function getOrderForRealtimeById({ orderId, selectSql }) {
  const { data, error } = await readAdapter.getOrderForRealtimeById(orderId, selectSql);
  if (error) throw error;
  return data || null;
}

export async function getSalePrintBundle({ businessId, saleId }) {
  const [{ data: saleRow, error: saleError }, { data: saleDetails, error: detailsError }] = await Promise.all([
    readAdapter.getSaleForPrintByBusinessAndId({ businessId, saleId }),
    readAdapter.getSaleDetailsForPrintBySaleId(saleId)
  ]);

  if (saleError) throw saleError;
  if (detailsError) throw detailsError;

  return {
    saleRow: saleRow || null,
    saleDetails: saleDetails || []
  };
}
