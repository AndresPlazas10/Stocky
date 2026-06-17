import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import { useSupabaseRealtime } from '../../../hooks/useSupabaseRealtime';
import {
  isOwnerRole,
  listEmployeesForManagement,
  type EmpleadoRecord,
} from '../../../services/empleadosService';
import { EMPLOYEES_PAGE_SIZE, normalizeRole } from '../empleadosUtils';

type UseEmpleadoDataParams = {
  businessId: string;
  source: 'owner' | 'employee';
  userId: string;
};

export function useEmpleadoData({ businessId, source, userId }: UseEmpleadoDataParams) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState<EmpleadoRecord[]>([]);
  const [canManageEmployees, setCanManageEmployees] = useState(source === 'owner');
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMoreEmployees, setHasMoreEmployees] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const employeesRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listEmployeesForManagement(businessId, {
        limit: EMPLOYEES_PAGE_SIZE,
        offset: 0,
      });
      setEmployees(list.filter((employee) => !isOwnerRole(employee.role)));
      setHasMoreEmployees(list.length === EMPLOYEES_PAGE_SIZE);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const refreshEmployees = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await listEmployeesForManagement(businessId, {
        limit: EMPLOYEES_PAGE_SIZE,
        offset: 0,
      });
      setEmployees(list.filter((employee) => !isOwnerRole(employee.role)));
      setHasMoreEmployees(list.length === EMPLOYEES_PAGE_SIZE);
      setPage(1);
    } finally {
      setRefreshing(false);
    }
  }, [businessId]);

  const refreshEmployeesSilently = useCallback(async () => {
    try {
      const list = await listEmployeesForManagement(businessId, {
        limit: EMPLOYEES_PAGE_SIZE,
        offset: 0,
      });
      setEmployees(list.filter((employee) => !isOwnerRole(employee.role)));
      setHasMoreEmployees(list.length === EMPLOYEES_PAGE_SIZE);
      setPage(1);
    } catch {
      // no-op
    }
  }, [businessId]);

  const loadMoreEmployees = useCallback(async () => {
    if (loadingMore || !hasMoreEmployees) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const list = await listEmployeesForManagement(businessId, {
        limit: EMPLOYEES_PAGE_SIZE,
        offset: (nextPage - 1) * EMPLOYEES_PAGE_SIZE,
      });
      const normalized = list.filter((employee) => !isOwnerRole(employee.role));
      setEmployees((prev) => [...prev, ...normalized]);
      setHasMoreEmployees(list.length === EMPLOYEES_PAGE_SIZE);
      setPage(nextPage);
    } catch {
      // no-op
    } finally {
      setLoadingMore(false);
    }
  }, [businessId, hasMoreEmployees, loadingMore, page]);

  const checkManagePermission = useCallback(async () => {
    if (source === 'owner') {
      setCanManageEmployees(true);
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
      setCanManageEmployees(role === 'admin' || role.includes('admin'));
    } catch {
      setCanManageEmployees(false);
    } finally {
      setCheckingPermissions(false);
    }
  }, [businessId, source, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void loadData();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void checkManagePermission();
  }, [checkManagePermission, loadData]);

  const scheduleEmployeesRefresh = useCallback(() => {
    if (employeesRealtimeRefreshTimerRef.current) return;
    employeesRealtimeRefreshTimerRef.current = setTimeout(() => {
      employeesRealtimeRefreshTimerRef.current = null;
      void refreshEmployeesSilently();
    }, 120);
  }, [refreshEmployeesSilently]);

  useSupabaseRealtime({
    channelKey: 'empleados',
    businessId,
    tables: [
      {
        table: 'employees',
        filter: `business_id=eq.${businessId}`,
        onEvent: scheduleEmployeesRefresh,
      },
    ],
    onSubscribed: scheduleEmployeesRefresh,
    onPollTick: scheduleEmployeesRefresh,
    onCleanup: () => {
      if (employeesRealtimeRefreshTimerRef.current) {
        clearTimeout(employeesRealtimeRefreshTimerRef.current);
        employeesRealtimeRefreshTimerRef.current = null;
      }
    },
  });

  return {
    loading,
    refreshing,
    employees,
    canManageEmployees,
    checkingPermissions,
    hasMoreEmployees,
    loadingMore,
    refreshEmployees,
    loadMoreEmployees,
    refreshEmployeesSilently,
  };
}

export type UseEmpleadoDataReturn = ReturnType<typeof useEmpleadoData>;
