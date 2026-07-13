import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshot.js';
import { getProductsForOrdersByBusiness } from '../data/queries/ordersQueries';
import { fetchComboCatalog } from '../services/combosService';

interface UseMesaCatalogProps {
  businessId: string;
  setProducts: (products: any[]) => void;
  setCombos: (combos: any[]) => void;
  setError: (error: string) => void;
}

export function useMesaCatalog({ businessId, setProducts, setCombos, setError }: UseMesaCatalogProps) {
  const { t } = useTranslation(['mesas']);
  const catalogWarmupPromiseRef = useRef<PromiseSettledResult<void>[] | null>(null);

  const loadProductos = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `mesas.productos:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setProducts(offlineSnapshot);
    }

    try {
      const data = await getProductsForOrdersByBusiness(businessId);
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setProducts(offlineSnapshot);
        return;
      }

      setProducts(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
    } catch {
      const cached = readOfflineSnapshot(offlineSnapshotKey, []);
      if (Array.isArray(cached) && cached.length > 0) {
        setProducts(cached);
        return;
      }

      if (offline) {
        setProducts([]);
      } else {
        setError(t('mesas.errors.loadCatalogFailed'));
      }
    }
  }, [businessId, setProducts, setError, t]);

  const loadCombos = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `mesas.combos:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setCombos(offlineSnapshot);
    }

    try {
      const data = await fetchComboCatalog(businessId);
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setCombos(offlineSnapshot);
        return;
      }

      setCombos(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
    } catch {
      const cached = readOfflineSnapshot(offlineSnapshotKey, []);
      if (Array.isArray(cached) && cached.length > 0) {
        setCombos(cached);
        return;
      }

      if (offline) {
        setCombos([]);
      } else {
        setError(t('mesas.errors.loadCombosFailed'));
      }
    }
  }, [businessId, setCombos, setError, t]);

  const ensureCatalogWarmup = useCallback(async (): Promise<void> => {
    if (catalogWarmupPromiseRef.current) {
      return;
    }

    catalogWarmupPromiseRef.current = await Promise.allSettled([
      loadProductos(),
      loadCombos(),
    ]).finally(() => {
      catalogWarmupPromiseRef.current = null;
    });
  }, [loadProductos, loadCombos]);

  return { loadProductos, loadCombos, ensureCatalogWarmup };
}
