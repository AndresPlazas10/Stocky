import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import { useSupabaseRealtime } from '../../../hooks/useSupabaseRealtime';
import {
  listComboProducts,
  listCombosByBusiness,
  type ComboProductRecord,
  type ComboRecord,
} from '../../../services/combosService';
import { normalizeRole } from '../comboUtils';

export function useComboData(
  businessId: string,
  userId: string,
  source: 'owner' | 'employee',
) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [combos, setCombos] = useState<ComboRecord[]>([]);
  const [products, setProducts] = useState<ComboProductRecord[]>([]);
  const [canManageCombos, setCanManageCombos] = useState(source === 'owner');
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  const combosRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const combosProductsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productsById = useMemo(() => {
    const map = new Map<string, ComboProductRecord>();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCombos, nextProducts] = await Promise.all([
        listCombosByBusiness(businessId),
        listComboProducts(businessId),
      ]);
      setCombos(nextCombos);
      setProducts(nextProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los combos.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const refreshCombos = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const nextCombos = await listCombosByBusiness(businessId);
      setCombos(nextCombos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la lista de combos.');
    } finally {
      setRefreshing(false);
    }
  }, [businessId]);

  const refreshCombosSilently = useCallback(async () => {
    try {
      const nextCombos = await listCombosByBusiness(businessId);
      setCombos(nextCombos);
    } catch {}
  }, [businessId]);

  const refreshProductsSilently = useCallback(async () => {
    try {
      const nextProducts = await listComboProducts(businessId);
      setProducts(nextProducts);
    } catch {}
  }, [businessId]);

  const checkManagePermission = useCallback(async () => {
    if (source === 'owner') {
      setCanManageCombos(true);
      return;
    }

    setCheckingPermissions(true);
    try {
      const client = getSupabaseClient();
      const { data, error: roleError } = await client
        .from('employees')
        .select('role')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (roleError) throw roleError;
      const role = normalizeRole(data?.role);
      setCanManageCombos(role === 'admin' || role.includes('admin'));
    } catch {
      setCanManageCombos(false);
    } finally {
      setCheckingPermissions(false);
    }
  }, [businessId, source, userId]);

  useEffect(() => {
    loadData();
    checkManagePermission();
  }, [checkManagePermission, loadData]);

  const scheduleCombosRefresh = useCallback(() => {
    if (combosRealtimeRefreshTimerRef.current) return;
    combosRealtimeRefreshTimerRef.current = setTimeout(() => {
      combosRealtimeRefreshTimerRef.current = null;
      void refreshCombosSilently();
    }, 120);
  }, [refreshCombosSilently]);

  const scheduleProductsRefresh = useCallback(() => {
    if (combosProductsRefreshTimerRef.current) return;
    combosProductsRefreshTimerRef.current = setTimeout(() => {
      combosProductsRefreshTimerRef.current = null;
      void refreshProductsSilently();
    }, 180);
  }, [refreshProductsSilently]);

  useSupabaseRealtime({
    channelKey: 'combos',
    businessId,
    tables: [
      { table: 'combos', filter: `business_id=eq.${businessId}`, onEvent: scheduleCombosRefresh },
      { table: 'combo_items', onEvent: scheduleCombosRefresh },
      { table: 'products', filter: `business_id=eq.${businessId}`, onEvent: scheduleProductsRefresh },
    ],
    onSubscribed: scheduleCombosRefresh,
    onPollTick: scheduleCombosRefresh,
    onCleanup: () => {
      if (combosRealtimeRefreshTimerRef.current) {
        clearTimeout(combosRealtimeRefreshTimerRef.current);
        combosRealtimeRefreshTimerRef.current = null;
      }
      if (combosProductsRefreshTimerRef.current) {
        clearTimeout(combosProductsRefreshTimerRef.current);
        combosProductsRefreshTimerRef.current = null;
      }
    },
  });

  return {
    loading,
    refreshing,
    error,
    setError,
    combos,
    setCombos,
    products,
    productsById,
    canManageCombos,
    checkingPermissions,
    refreshCombos,
    refreshProductsSilently,
  };
}
