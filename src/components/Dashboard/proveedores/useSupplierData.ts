import { useState, useCallback, useEffect } from 'react';
import { getSuppliersForManagementPage } from '@/data/queries/suppliersQueries';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '@/utils/offlineSnapshot';

const SUPPLIERS_PAGE_SIZE = 50;

export function useSupplierData(businessId: string, showError: (t: string, m?: string) => void, t: (k: string, o?: any) => string) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierTaxColumn, setSupplierTaxColumn] = useState('nit');
  const [page, setPage] = useState(1);
  const [hasMoreSuppliers, setHasMoreSuppliers] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadProveedores = useCallback(async ({ nextPage = 1, append = false } = {}) => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `proveedores.list:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setSuppliers(offlineSnapshot);
      setHasMoreSuppliers(false);
      setPage(1);
    }

    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const offset = (nextPage - 1) * SUPPLIERS_PAGE_SIZE;
      const { suppliers: data, taxColumn, hasMore } = await getSuppliersForManagementPage({ businessId, preferredTaxColumn: supplierTaxColumn, limit: SUPPLIERS_PAGE_SIZE, offset });

      if (taxColumn !== supplierTaxColumn) setSupplierTaxColumn(taxColumn);
      const normalized = Array.isArray(data) ? data : [];
      const hasLocalData = normalized.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setSuppliers(offlineSnapshot);
        setHasMoreSuppliers(false);
        setPage(1);
        return;
      }

      setSuppliers((prev) => {
        const next = append ? [...prev, ...normalized] : normalized;
        if (!offline || hasLocalData) saveOfflineSnapshot(offlineSnapshotKey, next);
        return next;
      });
      setHasMoreSuppliers(Boolean(hasMore));
      setPage(nextPage);
    } catch (err) {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        setSuppliers(Array.isArray(cached) ? cached : []);
        setHasMoreSuppliers(false);
        setPage(1);
      } else {
        showError(t('errors.loadingSuppliers'), (err as Error)?.message || t('errors.unknown'));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [businessId, supplierTaxColumn, showError, t]);

  useEffect(() => {
    if (businessId) loadProveedores({ nextPage: 1, append: false });
  }, [businessId, loadProveedores]);

  const fetchMoreSuppliers = useCallback(() => {
    if (loadingMore || !hasMoreSuppliers) return;
    loadProveedores({ nextPage: page + 1, append: true });
  }, [hasMoreSuppliers, loadingMore, loadProveedores, page]);

  return {
    suppliers, setSuppliers,
    loading, setLoading,
    loadingMore, hasMoreSuppliers,
    supplierTaxColumn, setSupplierTaxColumn,
    loadProveedores, fetchMoreSuppliers,
    page,
  };
}
