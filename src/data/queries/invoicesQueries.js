import { readAdapter } from '../adapters/localAdapter';

export async function getBusinessContextByUserId(userId) {
  if (!userId) return { businessId: null, employeeId: null };

  const { data: activeEmployee, error: activeError } = await readAdapter.getActiveEmployeeByUserId(
    userId,
    'id, business_id'
  );
  if (activeError) throw activeError;

  if (activeEmployee?.business_id) {
    return {
      businessId: activeEmployee.business_id,
      employeeId: activeEmployee.id || null
    };
  }

  const { data: employee, error } = await readAdapter.getEmployeeByUserId(userId, 'id, business_id');
  if (error) throw error;

  return {
    businessId: employee?.business_id || null,
    employeeId: employee?.id || null
  };
}

export async function getInvoicesWithItemsByBusiness({
  businessId,
  invoiceColumns,
  invoiceItemsColumns
}) {
  const { data, error } = await readAdapter.getInvoicesWithItemsByBusiness({
    businessId,
    invoiceColumns,
    invoiceItemsColumns
  });

  if (error) throw error;
  return data || [];
}

export async function getProductsForInvoicesByBusiness(businessId, selectSql) {
  const { data, error } = await readAdapter.getProductsForInvoicesByBusiness(businessId, selectSql);
  if (error) throw error;
  return data || [];
}

export async function getProductsStockByIds(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) return [];

  const { data, error } = await readAdapter.getProductsStockByIds(productIds);
  if (error) throw error;
  return data || [];
}

export async function getInvoiceWithItemsById(invoiceId, invoiceItemsColumns) {
  const { data, error } = await readAdapter.getInvoiceWithItemsById(invoiceId, invoiceItemsColumns);
  if (error) throw error;
  return data || null;
}

export async function getInvoiceItemsByInvoiceId(invoiceId) {
  const { data, error } = await readAdapter.getInvoiceItemsByInvoiceId(invoiceId);
  if (error) throw error;
  return data || [];
}
