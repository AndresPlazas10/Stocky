import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import { useSupabaseRealtime } from '../../../hooks/useSupabaseRealtime';
import {
  listSuppliersForManagement,
  type ProveedorRecord,
  type SupplierTaxColumn,
} from '../../../services/proveedoresService';
import { normalizeRole, SUPPLIERS_PAGE_SIZE } from '../proveedoresUtils';

interface UseProveedorDataParams {
  businessId: string;
  source: 'owner' | 'employee';
  userId: string;
}

export function useProveedorData({ businessId, source, userId }: UseProveedorDataParams) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<ProveedorRecord[]>([]);
  const [canManageSuppliers, setCanManageSuppliers] = useState(source === 'owner');
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [taxColumn, setTaxColumn] = useState<SupplierTaxColumn>('nit');
  const [page, setPage] = useState(1);
  const [hasMoreSuppliers, setHasMoreSuppliers] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const suppliersRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSuppliersForManagement({
        businessId,
        preferredTaxColumn: taxColumn,
        limit: SUPPLIERS_PAGE_SIZE,
        offset: 0,
      });

      setSuppliers(result.suppliers);
      if (result.taxColumn !== taxColumn) {
        setTaxColumn(result.taxColumn);
      }
      setHasMoreSuppliers(result.suppliers.length === SUPPLIERS_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los proveedores.');
    } finally {
      setLoading(false);
    }
  }, [businessId, taxColumn]);

  const refreshSuppliers = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const result = await listSuppliersForManagement({
        businessId,
        preferredTaxColumn: taxColumn,
        limit: SUPPLIERS_PAGE_SIZE,
        offset: 0,
      });

      setSuppliers(result.suppliers);
      if (result.taxColumn !== taxColumn) {
        setTaxColumn(result.taxColumn);
      }
      setHasMoreSuppliers(result.suppliers.length === SUPPLIERS_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la lista de proveedores.');
    } finally {
      setRefreshing(false);
    }
  }, [businessId, taxColumn]);

  const refreshSuppliersSilently = useCallback(async () => {
    try {
      const result = await listSuppliersForManagement({
        businessId,
        preferredTaxColumn: taxColumn,
        limit: SUPPLIERS_PAGE_SIZE,
        offset: 0,
      });
      setSuppliers(result.suppliers);
      if (result.taxColumn !== taxColumn) {
        setTaxColumn(result.taxColumn);
      }
      setHasMoreSuppliers(result.suppliers.length === SUPPLIERS_PAGE_SIZE);
      setPage(1);
    } catch {}
  }, [businessId, taxColumn]);

  const loadMoreSuppliers = useCallback(async () => {
    if (loadingMore || !hasMoreSuppliers) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await listSuppliersForManagement({
        businessId,
        preferredTaxColumn: taxColumn,
        limit: SUPPLIERS_PAGE_SIZE,
        offset: (nextPage - 1) * SUPPLIERS_PAGE_SIZE,
      });
      setSuppliers((prev) => [...prev, ...result.suppliers]);
      if (result.taxColumn !== taxColumn) {
        setTaxColumn(result.taxColumn);
      }
      setHasMoreSuppliers(result.suppliers.length === SUPPLIERS_PAGE_SIZE);
      setPage(nextPage);
    } catch {}
    finally {
      setLoadingMore(false);
    }
  }, [businessId, hasMoreSuppliers, loadingMore, page, taxColumn]);

  const checkManagePermission = useCallback(async () => {
    if (source === 'owner') {
      setCanManageSuppliers(true);
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
      setCanManageSuppliers(role === 'admin' || role.includes('admin'));
    } catch {
      setCanManageSuppliers(false);
    } finally {
      setCheckingPermissions(false);
    }
  }, [businessId, source, userId]);

  useEffect(() => {
    loadData();
    checkManagePermission();
  }, [checkManagePermission, loadData]);

  const scheduleSuppliersRefresh = useCallback(() => {
    if (suppliersRealtimeRefreshTimerRef.current) return;
    suppliersRealtimeRefreshTimerRef.current = setTimeout(() => {
      suppliersRealtimeRefreshTimerRef.current = null;
      void refreshSuppliersSilently();
    }, 120);
  }, [refreshSuppliersSilently]);

  useSupabaseRealtime({
    channelKey: 'proveedores',
    businessId,
    tables: [
      { table: 'suppliers', filter: `business_id=eq.${businessId}`, onEvent: scheduleSuppliersRefresh },
    ],
    onSubscribed: scheduleSuppliersRefresh,
    onPollTick: scheduleSuppliersRefresh,
    onCleanup: () => {
      if (suppliersRealtimeRefreshTimerRef.current) {
        clearTimeout(suppliersRealtimeRefreshTimerRef.current);
        suppliersRealtimeRefreshTimerRef.current = null;
      }
    },
  });

  return {
    loading,
    refreshing,
    error,
    setError,
    suppliers,
    canManageSuppliers,
    checkingPermissions,
    taxColumn,
    page,
    hasMoreSuppliers,
    loadingMore,
    refreshSuppliers,
    loadMoreSuppliers,
  };
}
