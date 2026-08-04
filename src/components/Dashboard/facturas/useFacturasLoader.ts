import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthenticatedUser } from '@/data/queries/authQueries';
import { getBusinessContextByUserId } from '@/data/queries/invoicesQueries';
import { getInvoicesWithItemsByBusiness, getProductsForInvoicesByBusiness } from '@/data/queries/invoicesQueries';

const INVOICE_LIST_COLUMNS = `id, business_id, employee_id, invoice_number, customer_name, customer_email, customer_id_number, payment_method, subtotal, tax, total, notes, status, issued_at, created_at, sent_at, cancelled_at`;
const INVOICE_ITEM_LIST_COLUMNS = `id, product_name, quantity, unit_price, total`;
const PRODUCT_INVOICE_COLUMNS = 'id, code, name, sale_price, stock, business_id, is_active';

export function useFacturasLoader(businessIdProp: string | null, t: (key: string, opts?: any) => string) {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadFacturas = useCallback(async (bizId: string) => {
    setInvoices(await getInvoicesWithItemsByBusiness({
      businessId: bizId,
      invoiceColumns: INVOICE_LIST_COLUMNS,
      invoiceItemsColumns: INVOICE_ITEM_LIST_COLUMNS
    }));
  }, []);

  const resolveBusinessContext = useCallback(async () => {
    if (businessIdProp) {
      return { userId: null, businessId: businessIdProp, employeeId: null };
    }
    const user = await getAuthenticatedUser();
    if (!user) {
      const sessionError = new Error(t('facturas:errors.sessionRequired')) as Error & { code: string };
      sessionError.code = 'SESSION_EXPIRED';
      throw sessionError;
    }
    const { businessId, employeeId } = await getBusinessContextByUserId(user.id);
    if (!businessId) throw new Error(t('facturas:errors.loadFailed'));
    return { userId: user.id, businessId, employeeId };
  }, [businessIdProp, t]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { businessId } = await resolveBusinessContext();
      const [, productsData] = await Promise.all([
        loadFacturas(businessId),
        getProductsForInvoicesByBusiness(businessId, PRODUCT_INVOICE_COLUMNS)
      ]);
      setProducts(productsData);
    } catch (err: any) {
      if (err?.code === 'SESSION_EXPIRED') {
        setTimeout(() => navigate('/login'), 2000);
      }
      setError(err.message || t('facturas:errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [resolveBusinessContext, loadFacturas, navigate, t]);

  return {
    invoices, setInvoices,
    products, setProducts,
    loading, setLoading,
    error, setError,
    loadFacturas, loadData, resolveBusinessContext,
  };
}
