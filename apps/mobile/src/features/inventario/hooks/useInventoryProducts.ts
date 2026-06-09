import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listInventoryProducts,
  listInventorySuppliers,
  type InventoryProductRecord,
  type InventorySupplierRecord,
} from '../../../services/inventoryService';
import { hydrateProductsWithSuppliers, INVENTORY_PAGE_SIZE } from '../inventoryUtils';

export function useInventoryProducts(businessId: string) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<InventoryProductRecord[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplierRecord[]>([]);
  const [page, setPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const suppliersRef = useRef<InventorySupplierRecord[]>([]);
  const inventoryRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inventorySuppliersRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    suppliersRef.current = suppliers;
  }, [suppliers]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProducts, nextSuppliers] = await Promise.all([
        listInventoryProducts(businessId, {
          includeSuppliers: false,
          limit: INVENTORY_PAGE_SIZE,
          offset: 0,
        }),
        listInventorySuppliers(businessId),
      ]);
      setSuppliers(nextSuppliers);
      setProducts(hydrateProductsWithSuppliers(nextProducts, nextSuppliers));
      setHasMoreProducts(nextProducts.length === INVENTORY_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar inventario.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const refreshProducts = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [nextProducts, nextSuppliers] = await Promise.all([
        listInventoryProducts(businessId, {
          includeSuppliers: false,
          limit: INVENTORY_PAGE_SIZE,
          offset: 0,
        }),
        listInventorySuppliers(businessId),
      ]);
      setSuppliers(nextSuppliers);
      setProducts(hydrateProductsWithSuppliers(nextProducts, nextSuppliers));
      setHasMoreProducts(nextProducts.length === INVENTORY_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar inventario.');
    } finally {
      setRefreshing(false);
    }
  }, [businessId]);

  const refreshProductsSilently = useCallback(async () => {
    try {
      const nextProducts = await listInventoryProducts(businessId, {
        includeSuppliers: false,
        limit: INVENTORY_PAGE_SIZE,
        offset: 0,
      });
      setProducts(hydrateProductsWithSuppliers(nextProducts, suppliersRef.current));
      setHasMoreProducts(nextProducts.length === INVENTORY_PAGE_SIZE);
      setPage(1);
    } catch {}
  }, [businessId]);

  const refreshSuppliersSilently = useCallback(async () => {
    try {
      const nextSuppliers = await listInventorySuppliers(businessId);
      setSuppliers(nextSuppliers);
      setProducts((prev) => hydrateProductsWithSuppliers(prev, nextSuppliers));
    } catch {}
  }, [businessId]);

  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || !hasMoreProducts) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const nextProducts = await listInventoryProducts(businessId, {
        includeSuppliers: false,
        limit: INVENTORY_PAGE_SIZE,
        offset: (nextPage - 1) * INVENTORY_PAGE_SIZE,
      });
      setProducts((prev) => hydrateProductsWithSuppliers([...prev, ...nextProducts], suppliersRef.current));
      setHasMoreProducts(nextProducts.length === INVENTORY_PAGE_SIZE);
      setPage(nextPage);
    } catch {}
    finally {
      setLoadingMore(false);
    }
  }, [businessId, hasMoreProducts, loadingMore, page]);

  return {
    loading,
    refreshing,
    error,
    setError,
    products,
    setProducts,
    suppliers,
    setSuppliers,
    page,
    hasMoreProducts,
    loadingMore,
    suppliersRef,
    inventoryRealtimeRefreshTimerRef,
    inventorySuppliersRefreshTimerRef,
    loadData,
    refreshProducts,
    refreshProductsSilently,
    refreshSuppliersSilently,
    loadMoreProducts,
  };
}
