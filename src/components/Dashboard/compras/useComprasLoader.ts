import { useState, useCallback } from 'react';
import { logger } from '@/utils/logger';
import { getFilteredPurchases } from '@/services/purchasesService';
import { getProductsForPurchase, getSuppliersForBusiness, getEmployeesByBusiness } from '@/data/queries/purchasesQueries';
import { getBusinessOwnerById } from '@/data/queries/authQueries';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '@/utils/offlineSnapshot';
import { formatLoadError } from '@/utils/connectivity';

export function useComprasLoader(businessId: string, t: (key: string, options?: any) => string) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [pagePurchases, setPagePurchases] = useState(1);
  const [limitPurchases] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 20 : 30));
  const [totalCountPurchases, setTotalCountPurchases] = useState(0);
  const [currentFiltersPurchases, setCurrentFiltersPurchases] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [error, setError] = useState('');

  const loadCompras = useCallback(async (filters = currentFiltersPurchases, pagination: any = {}) => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `compras.list:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setPurchases(offlineSnapshot);
      setTotalCountPurchases(offlineSnapshot.length);
    }

    try {
      setLoading(true);
      const lim = Number(pagination.limit ?? limitPurchases);
      const off = Number(pagination.offset ?? ((pagePurchases - 1) * lim));
      const includeCount = typeof pagination.includeCount === 'boolean' ? pagination.includeCount : off === 0;
      const countMode = pagination.countMode || 'planned';
      const { data: purchasesData, count, error: purchasesError } = await getFilteredPurchases(businessId, filters, { limit: lim, offset: off, includeCount, countMode }) as any;
      if (purchasesError) throw new Error(purchasesError);

      const normalizedData = Array.isArray(purchasesData) ? purchasesData : [];
      const [supplier, employees] = await Promise.all([
        getBusinessOwnerById(businessId).catch(() => null),
        getEmployeesByBusiness(businessId).catch(() => [] as any[]),
      ]);
      const enriched = normalizedData.map((purchase: any) => ({
        ...purchase,
        supplier,
        employee: employees?.find((e: any) => e.id === purchase?.employee_id) || null,
      }));

      setPurchases(enriched);
      if (typeof count === 'number') setTotalCountPurchases(count);
      else if (!includeCount) setTotalCountPurchases(off + normalizedData.length);
      saveOfflineSnapshot(offlineSnapshotKey, enriched);
    } catch (err: any) {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        setPurchases(Array.isArray(cached) ? cached : []);
        setTotalCountPurchases(Array.isArray(cached) ? cached.length : 0);
      } else {
        setError(formatLoadError(t('compras:labels.purchases'), err));
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, pagePurchases, limitPurchases, currentFiltersPurchases, t]);

  const loadProductos = useCallback(async () => {
    try {
      const data = await getProductsForPurchase(businessId);
      setProducts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      logger.error('loadProductos for purchase failed', { businessId, error: error.message || error });
    }
  }, [businessId]);

  const loadProveedores = useCallback(async () => {
    try {
      setLoadingSuppliers(true);
      const data = await getSuppliersForBusiness(businessId);
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      logger.error('loadProveedores for purchase failed', { businessId, error: error.message || error });
    } finally {
      setLoadingSuppliers(false);
    }
  }, [businessId]);

  return {
    purchases, setPurchases,
    pagePurchases, setPagePurchases,
    limitPurchases,
    totalCountPurchases, setTotalCountPurchases,
    currentFiltersPurchases, setCurrentFiltersPurchases,
    loading, setLoading,
    products, setProducts,
    suppliers, setSuppliers,
    loadingSuppliers,
    error, setError,
    loadCompras, loadProductos, loadProveedores,
  };
}
