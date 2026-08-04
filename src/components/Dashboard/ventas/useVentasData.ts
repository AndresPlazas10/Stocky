import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import { getFilteredSales } from '@/services/salesService';
import { getProductsForSale } from '@/data/queries/salesQueries';
import { fetchComboCatalog } from '@/services/combosService';
import { getAuthenticatedUser, isEmployeeInBusiness, getEmployeeRoleInBusiness } from '@/data/queries/authQueries';
import { isAdminRole } from '@/utils/roles';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '@/utils/offlineSnapshot';
import { formatLoadError } from '@/utils/connectivity';

export function useVentasData(businessId: string) {
  const navigate = useNavigate();
  const { t } = useTranslation(['ventas', 'common']);

  const [sales, setSales] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 20 : 30));
  const [totalCount, setTotalCount] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);

  const loadVentas = useCallback(async (filters = currentFilters, pagination: any = {}) => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `ventas.list:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setSales(offlineSnapshot);
      setTotalCount(offlineSnapshot.length);
    }

    try {
      const lim = Number(pagination.limit ?? limit);
      const off = Number(pagination.offset ?? ((page - 1) * lim));
      const includeCount = typeof pagination.includeCount === 'boolean'
        ? pagination.includeCount
        : off === 0;
      const countMode = pagination.countMode || 'planned';
      
      const { data, count, error: salesError } = await getFilteredSales(businessId, filters, {
        limit: lim,
        offset: off,
        includeCount,
        countMode
      }) as any;
      if (salesError) {
        throw new Error(salesError);
      }
      
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setSales(offlineSnapshot);
        setTotalCount(offlineSnapshot.length);
        return;
      }

      setSales(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
      if (typeof count === 'number') {
        setTotalCount(count);
      } else if (!includeCount) {
        setTotalCount(off + normalizedData.length);
      }
    } catch (err) {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        const safe = Array.isArray(cached) ? cached : [];
        setSales(safe);
        setTotalCount(safe.length);
      } else {
        setSales([]);
        setTotalCount(0);
        setError(formatLoadError(t('ventas:labels.sales'), err));
      }
    }
  }, [businessId, page, limit, currentFilters, t]);

  const loadProductos = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `ventas.productos:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setProducts(offlineSnapshot);
    }

    try {
      const data = await getProductsForSale(businessId);
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
    } catch (error: any) {
      logger.error('loadProductos failed', { businessId, error: error.message || error });
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        setProducts(Array.isArray(cached) ? cached : []);
      } else {
        throw new Error(t('ventas:errors.loadProductsFailed'));
      }
    }
  }, [businessId, t]);

  const loadCombos = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `ventas.combos:${businessId}`;
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
    } catch (error: any) {
      logger.error('loadCombos failed', { businessId, error: error.message || error });
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        setCombos(Array.isArray(cached) ? cached : []);
      } else {
        throw new Error(t('ventas:errors.loadCombosFailed'));
      }
    }
  }, [businessId, t]);

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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
      
      let user = null;
      let authError = null;
      try {
        user = await getAuthenticatedUser();
      } catch (error) {
        authError = error;
      }
      
      if (authError || !user?.id) {
        if (offlineMode) {
          setSessionChecked(true);
          setError('⚠️ ' + t('ventas:errors.offlineMode'));
        } else {
          setError('⚠️ ' + t('ventas:errors.sessionExpired'));
          setLoading(false);
          setTimeout(() => {
            navigate('/login');
          }, 2000);
          return;
        }
      } else {
        setSessionChecked(true);
      }
      
      await Promise.all([
        loadVentas(),
        loadProductos(),
        loadCombos(),
        checkIfEmployee()
      ]);
    } catch (error: any) {
      logger.error('loadData failed', { businessId, error: error.message || error });
      setError('⚠️ ' + t('ventas:errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadVentas, loadProductos, loadCombos, checkIfEmployee, navigate, t]);

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId, loadData]);

  return {
    sales, setSales,
    page, setPage,
    limit,
    totalCount, setTotalCount,
    currentFilters, setCurrentFilters,
    products, setProducts,
    combos, setCombos,
    loading, setLoading,
    error, setError,
    sessionChecked,
    isEmployee,
    loadVentas, loadProductos, loadCombos, loadData,
  };
}
