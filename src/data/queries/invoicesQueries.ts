import { readAdapter } from '../adapters/localAdapter';
import type { Product, Invoice, InvoiceItem } from '../../types';

interface BusinessContext {
  businessId: string | null;
  employeeId: string | null;
}

export async function getBusinessContextByUserId(userId: string | null): Promise<BusinessContext> {
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
}: {
  businessId: string;
  invoiceColumns: string;
  invoiceItemsColumns: string;
}): Promise<(Invoice & { items?: InvoiceItem[] })[]> {
  const { data, error } = await readAdapter.getInvoicesWithItemsByBusiness({
    businessId,
    invoiceColumns,
    invoiceItemsColumns
  });

  if (error) throw error;
  return data || [];
}

export async function getProductsForInvoicesByBusiness(
  businessId: string,
  selectSql?: string
): Promise<Product[]> {
  const { data, error } = await readAdapter.getProductsForInvoicesByBusiness(businessId, selectSql);
  if (error) throw error;
  return data || [];
}

export async function getProductsStockByIds(productIds: string[]): Promise<Product[]> {
  if (!Array.isArray(productIds) || productIds.length === 0) return [];

  const { data, error } = await readAdapter.getProductsStockByIds(productIds);
  if (error) throw error;
  return data || [];
}

export async function getInvoiceWithItemsById(
  invoiceId: string,
  invoiceItemsColumns?: string
): Promise<(Invoice & { items?: InvoiceItem[] }) | null> {
  const { data, error } = await readAdapter.getInvoiceWithItemsById(invoiceId, invoiceItemsColumns);
  if (error) throw error;
  return data || null;
}

export async function getInvoiceItemsByInvoiceId(invoiceId: string): Promise<InvoiceItem[]> {
  const { data, error } = await readAdapter.getInvoiceItemsByInvoiceId(invoiceId);
  if (error) throw error;
  return data || [];
}
