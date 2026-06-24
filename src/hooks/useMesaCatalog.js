import { useCallback, useRef } from 'react';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshot.js';
import { getProductsForOrdersByBusiness } from '../data/queries/ordersQueries';
import { fetchComboCatalog } from '../services/combosService';

export function useMesaCatalog({ businessId, setProductos, setCombos, setError }) {
  const catalogWarmupPromiseRef = useRef(null);

  const loadProductos = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `mesas.productos:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setProductos(offlineSnapshot);
    }

    try {
      const data = await getProductsForOrdersByBusiness(businessId);
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setProductos(offlineSnapshot);
        return;
      }

      setProductos(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
    } catch {
      const cached = readOfflineSnapshot(offlineSnapshotKey, []);
      if (Array.isArray(cached) && cached.length > 0) {
        setProductos(cached);
        return;
      }

      if (offline) {
        setProductos([]);
      } else {
        setError('No se pudo cargar los productos. Revisa tu conexión e intenta de nuevo.');
      }
    }
  }, [businessId, setProductos, setError]);

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
        setError('No se pudo cargar los combos. Revisa tu conexión e intenta de nuevo.');
      }
    }
  }, [businessId, setCombos, setError]);

  const ensureCatalogWarmup = useCallback(async () => {
    if (catalogWarmupPromiseRef.current) {
      return catalogWarmupPromiseRef.current;
    }

    catalogWarmupPromiseRef.current = Promise.allSettled([
      loadProductos(),
      loadCombos(),
    ]).finally(() => {
      catalogWarmupPromiseRef.current = null;
    });

    return catalogWarmupPromiseRef.current;
  }, [loadProductos, loadCombos]);

  return { loadProductos, loadCombos, ensureCatalogWarmup };
}
