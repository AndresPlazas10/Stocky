import { useState, useEffect, useCallback, useRef } from 'react';
import { useRealtimeSubscription } from '../../../hooks/useRealtime.js';
import { useLowMotionMode } from '../../../hooks/useLowMotionMode.js';
import { useProgressiveList } from '../../../hooks/useProgressiveList.js';
import {
  getInventoryProductsPage,
  getSupplierById,
  getSuppliersByBusiness,
} from '../../../data/queries/inventoryQueries';
import {
  getAuthenticatedUser,
  isEmployeeInBusiness,
  getEmployeeRoleInBusiness,
} from '../../../data/queries/authQueries';
import { isAdminRole } from '../../../utils/roles.js';
import {
  isOfflineMode,
  readOfflineSnapshot,
  saveOfflineSnapshot,
} from '../../../utils/offlineSnapshot.js';
import { INVENTORY_PAGE_SIZE } from './productFormConstants';
import type { ProductWithSupplier } from '../../../types/product';
import type { Supplier } from '../../../types/supplier';

export function useInventoryProducts(businessId: string, userRole: string = 'admin') {
  const [products, setProducts] = useState<ProductWithSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEmployee, setIsEmployee] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMoreProductsRemote, setHasMoreProductsRemote] = useState<boolean>(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState<boolean>(false);
  const loadMoreProductsRef = useRef<(() => void) | null>(null);

  const hasAdminPrivileges = isAdminRole(userRole);
  const lowMotionMode = useLowMotionMode();

  const {
    visibleItems: visibleProducts,
    hasMore: hasMoreProducts,
    hasMoreExternal: hasMoreProductsExternal,
    totalCount: totalProducts,
    sentinelRef: productsSentinelRef,
    loadMore: loadMoreProducts,
  } = useProgressiveList(products, {
    initialCount: lowMotionMode ? 16 : 24,
    step: lowMotionMode ? 16 : 24,
    resetKey: `${businessId}:${lowMotionMode ? 'low' : 'full'}`,
    preserveOnGrow: true,
    canLoadMore: hasMoreProductsRemote,
    onLoadMore: () => {
      if (loadMoreProductsRef.current) {
        loadMoreProductsRef.current();
      }
    },
    loading: loadingMoreProducts,
  } as Parameters<typeof useProgressiveList>[1]);

  const canLoadMoreProducts = hasMoreProducts || hasMoreProductsExternal;

  const syncProductsSnapshot = useCallback(
    (nextProducts: ProductWithSupplier[]) => {
      saveOfflineSnapshot(`inventario.productos:${businessId}`, nextProducts);
    },
    [businessId],
  );

  const setProductsWithSnapshot = useCallback(
    (updater: ProductWithSupplier[] | ((prev: ProductWithSupplier[]) => ProductWithSupplier[])) => {
      setProducts((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const normalized = Array.isArray(next) ? next : [];
        syncProductsSnapshot(normalized);
        return normalized;
      });
    },
    [syncProductsSnapshot],
  );

  const loadProducts = useCallback(
    async ({ nextPage = 1, append = false }: { nextPage?: number; append?: boolean } = {}) => {
      const offline = isOfflineMode();
      const offlineSnapshotKey = `inventario.productos:${businessId}`;
      const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

      if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setProducts(offlineSnapshot);
        setHasMoreProductsRemote(false);
        setPage(1);
      }

      try {
        if (append) {
          setLoadingMoreProducts(true);
        } else {
          setLoading(true);
        }
        const offset = (nextPage - 1) * INVENTORY_PAGE_SIZE;
        const data = await getInventoryProductsPage({
          businessId,
          limit: INVENTORY_PAGE_SIZE,
          offset,
        });
        const normalizedData = Array.isArray(data) ? data : [];
        const hasLocalData = normalizedData.length > 0;

        if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
          setProducts(offlineSnapshot);
          setHasMoreProductsRemote(false);
          setPage(1);
          return;
        }

        setProductsWithSnapshot((prev) => (append ? [...prev, ...normalizedData] : normalizedData));
        setHasMoreProductsRemote(normalizedData.length === INVENTORY_PAGE_SIZE);
        setPage(nextPage);
      } catch {
        if (offline) {
          const cached = readOfflineSnapshot(offlineSnapshotKey, []);
          setProducts(Array.isArray(cached) ? cached : []);
          setHasMoreProductsRemote(false);
          setPage(1);
        } else {
          setError('Error al cargar el inventario');
        }
      } finally {
        setLoading(false);
        setLoadingMoreProducts(false);
      }
    },
    [businessId, setProductsWithSnapshot],
  );

  const loadSuppliers = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `inventario.proveedores:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setSuppliers(offlineSnapshot);
    }

    try {
      const data = await getSuppliersByBusiness(businessId);
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setSuppliers(offlineSnapshot);
        return;
      }

      setSuppliers(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
    } catch {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        setSuppliers(Array.isArray(cached) ? cached : []);
      }
    }
  }, [businessId]);

  const checkIfEmployee = useCallback(async () => {
    try {
      const user = await getAuthenticatedUser();
      if (!user) {
        setIsEmployee(false);
        return;
      }

      const employeeRole = await getEmployeeRoleInBusiness({ userId: user.id, businessId });
      if (employeeRole) {
        setIsEmployee(!isAdminRole(employeeRole));
        return;
      }

      setIsEmployee(await isEmployeeInBusiness({ userId: user.id, businessId }));
    } catch {
      setIsEmployee(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadMoreProductsRef.current = () => {
      if (loadingMoreProducts || !hasMoreProductsRemote) return;
      loadProducts({ nextPage: page + 1, append: true });
    };
  }, [hasMoreProductsRemote, loadProducts, loadingMoreProducts, page]);

  useEffect(() => {
    if (businessId) {
      loadProducts();
      loadSuppliers();
      checkIfEmployee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, loadProducts, loadSuppliers]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useRealtimeSubscription('products', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    debounceMs: 150,
    pollingIntervalMs: 30000,
    pollingMode: 'onError',
    onPoll: () => loadProducts({ nextPage: 1, append: false }),
    onInsert: async (newProduct: ProductWithSupplier) => {
      let productWithSupplier = newProduct;
      if (newProduct.supplier_id) {
        const supplier = await getSupplierById(newProduct.supplier_id);
        productWithSupplier = { ...newProduct, supplier };
      }

      setProductsWithSnapshot((prev) => {
        const exists = prev.some((p) => p.id === newProduct.id);
        if (exists) return prev;
        return [productWithSupplier, ...prev];
      });

      setSuccess('Nuevo producto agregado');
      setTimeout(() => setSuccess(null), 3000);
    },
    onUpdate: (updatedProduct: ProductWithSupplier) => {
      setProductsWithSnapshot((prev) =>
        prev.map((p) => (p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p)),
      );
    },
    onDelete: (deletedProduct: ProductWithSupplier) => {
      setProductsWithSnapshot((prev) => prev.filter((p) => p.id !== deletedProduct.id));
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return {
    products,
    suppliers,
    loading,
    error,
    setError,
    success,
    setSuccess,
    isEmployee,
    hasAdminPrivileges,
    visibleProducts,
    canLoadMoreProducts,
    totalProducts,
    productsSentinelRef,
    loadingMoreProducts,
    loadMoreProducts,
    loadProducts,
    setProductsWithSnapshot,
  };
}
