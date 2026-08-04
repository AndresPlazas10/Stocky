import { useState, useCallback, useEffect } from 'react';
import { getEmployeesForManagementPage } from '@/data/queries/employeesQueries';

const EMPLOYEE_PAGE_SIZE = 50;

function isOwnerRole(role: string) {
  return String(role || '').trim().toLowerCase() === 'owner' || String(role || '').trim().toLowerCase() === 'propietario';
}

export function useEmployeeData(businessId: string, t: (k: string, o?: any) => string) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMoreEmployees, setHasMoreEmployees] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadEmployees = useCallback(async ({ nextPage = 1, append = false } = {}) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const offset = (nextPage - 1) * EMPLOYEE_PAGE_SIZE;
      const { employees: data, hasMore } = await getEmployeesForManagementPage({ businessId, limit: EMPLOYEE_PAGE_SIZE, offset });
      const normalized = (data || []).filter((e: any) => !isOwnerRole(e?.role));
      setEmployees((prev) => (append ? [...prev, ...normalized] : normalized));
      setPage(nextPage);
      setHasMoreEmployees(Boolean(hasMore));
    } catch {
      setError(t('empleados.errors.loadingEmployees'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [businessId, t]);

  useEffect(() => {
    if (businessId) loadEmployees({ nextPage: 1, append: false });
  }, [businessId, loadEmployees]);

  const loadMoreEmployees = useCallback(() => {
    if (loadingMore || !hasMoreEmployees) return;
    loadEmployees({ nextPage: page + 1, append: true });
  }, [hasMoreEmployees, loadingMore, loadEmployees, page]);

  return {
    employees, setEmployees,
    loading, setLoading,
    error, setError,
    hasMoreEmployees, loadingMore,
    loadEmployees, loadMoreEmployees,
    page,
  };
}
