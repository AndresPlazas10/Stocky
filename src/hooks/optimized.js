// =====================================================
// CUSTOM HOOKS OPTIMIZADOS
// =====================================================
// Hooks reutilizables con mejores prácticas
// Cache, error handling, retry logic
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/supabase/Client';

// =====================================================
// useAuth - Gestión centralizada de autenticación
// =====================================================

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (_event === 'SIGNED_OUT') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
      }

      if (_event === 'TOKEN_REFRESHED') {
        // Token refreshed
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'global' });
    localStorage.clear();
    sessionStorage.clear();
  }, []);

  return {
    user,
    session,
    loading,
    signOut,
    isAuthenticated: !!user,
  };
}

// =====================================================
// useBusinessAccess - Verificar acceso a negocio
// =====================================================

export function useBusinessAccess(businessId) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    async function verifyAccess() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setHasAccess(false);
          setLoading(false);
          return;
        }

        // Opción 1: Usar RPC function (más rápido)
        const { data: canAccess } = await supabase.rpc('check_business_access', {
          p_business_id: businessId,
          p_user_id: user.id,
        });

        if (canAccess) {
          // Determinar rol
          const { data: business } = await supabase
            .from('businesses')
            .select('created_by')
            .eq('id', businessId)
            .maybeSingle();

          if (business?.created_by === user.id) {
            setRole('owner');
          } else {
            const { data: employee } = await supabase
              .from('employees')
              .select('role')
              .eq('business_id', businessId)
              .eq('user_id', user.id)
              .maybeSingle();

            setRole(employee?.role || 'employee');
          }

          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        // Error verifying access
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    }

    verifyAccess();
  }, [businessId]);

  return { hasAccess, loading, role };
}

// =====================================================
// usePermissions - Gestión de permisos por rol
// =====================================================

const ROLE_PERMISSIONS = {
  owner: {
    canEditBusiness: true,
    canManageEmployees: true,
    canViewReports: true,
    canMakeSales: true,
    canManageInventory: true,
    canMakePurchases: true,
    canManageSuppliers: true,
    canDeleteSales: true,
    canViewAllData: true,
  },
  admin: {
    canEditBusiness: false,
    canManageEmployees: true,
    canViewReports: true,
    canMakeSales: true,
    canManageInventory: true,
    canMakePurchases: true,
    canManageSuppliers: true,
    canDeleteSales: true,
    canViewAllData: true,
  },
  cashier: {
    canEditBusiness: false,
    canManageEmployees: false,
    canViewReports: false,
    canMakeSales: true,
    canManageInventory: false,
    canMakePurchases: false,
    canManageSuppliers: false,
    canDeleteSales: false,
    canViewAllData: false,
  },
  warehouse: {
    canEditBusiness: false,
    canManageEmployees: false,
    canViewReports: false,
    canMakeSales: false,
    canManageInventory: true,
    canMakePurchases: true,
    canManageSuppliers: false,
    canDeleteSales: false,
    canViewAllData: false,
  },
};

export function usePermissions(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.cashier;
}

// =====================================================
// useSupabaseQuery - Query con retry y cache
// =====================================================

export function useSupabaseQuery(queryFn, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const executeQuery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await queryFn();

      if (result.error) {
        throw result.error;
      }

      setData(result.data);
      retryCountRef.current = 0;
    } catch (err) {
      // Query error

      // Reintentar en caso de error de red
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = 1000 * retryCountRef.current; // Backoff exponencial

        setTimeout(() => {
          executeQuery();
        }, delay);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [queryFn]);

  useEffect(() => {
    executeQuery();
  }, dependencies);

  const refetch = useCallback(() => {
    retryCountRef.current = 0;
    executeQuery();
  }, [executeQuery]);

  return { data, loading, error, refetch };
}

// =====================================================
// usePagination - Paginación optimizada
// =====================================================

export function usePagination(
  tableName,
  filters = {},
  pageSize = 50,
  orderBy = { column: 'created_at', ascending: false }
) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = useCallback(
    async (pageNumber) => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .order(orderBy.column, { ascending: orderBy.ascending })
          .range(
            pageNumber * pageSize,
            (pageNumber + 1) * pageSize - 1
          );

        // Aplicar filtros
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            query = query.eq(key, value);
          }
        });

        const { data: pageData, error: queryError, count } = await query;

        if (queryError) throw queryError;

        setData(pageData || []);
        setTotalCount(count || 0);
        setHasMore((pageNumber + 1) * pageSize < (count || 0));
        setPage(pageNumber);
      } catch (err) {
        // Pagination error
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [tableName, filters, pageSize, orderBy]
  );

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  const nextPage = useCallback(() => {
    if (hasMore && !loading) {
      loadPage(page + 1);
    }
  }, [hasMore, loading, page, loadPage]);

  const prevPage = useCallback(() => {
    if (page > 0 && !loading) {
      loadPage(page - 1);
    }
  }, [page, loading, loadPage]);

  const goToPage = useCallback(
    (pageNumber) => {
      if (pageNumber >= 0 && !loading) {
        loadPage(pageNumber);
      }
    },
    [loading, loadPage]
  );

  const refetch = useCallback(() => {
    loadPage(page);
  }, [page, loadPage]);

  return {
    data,
    loading,
    error,
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    hasMore,
    hasPrev: page > 0,
    nextPage,
    prevPage,
    goToPage,
    refetch,
  };
}

// =====================================================
// useRealtime - Subscripción a cambios en tiempo real
// =====================================================

export function useRealtime(tableName, filters = {}, onUpdate) {
  const channelRef = useRef(null);

  useEffect(() => {
    // Construir filtro para realtime
    let filterString = '';
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filterString += `${key}=eq.${value}`;
      }
    });

    // Crear canal único
    const channelName = `${tableName}-${filterString || 'all'}`;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: filterString || undefined,
        },
        (payload) => {
          if (onUpdate) {
            onUpdate(payload);
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [tableName, JSON.stringify(filters), onUpdate]);
}

// =====================================================
// useDebounce - Debouncing para búsquedas
// =====================================================

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// =====================================================
// useLocalStorage - Persistencia local con sync
// =====================================================

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // Error reading from localStorage
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        // Error writing to localStorage
      }
    },
    [key, storedValue]
  );

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      // Error removing from localStorage
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

// =====================================================
// useLowStockAlert - Hook para alertas de stock bajo
// =====================================================

export function useLowStockAlert(businessId, threshold = 10) {
  const { data, loading, error, refetch } = useSupabaseQuery(
    async () => {
      return supabase.rpc('get_low_stock_products', {
        p_business_id: businessId,
        p_threshold: threshold,
      });
    },
    [businessId, threshold]
  );

  const lowStockCount = data?.length || 0;
  const hasLowStock = lowStockCount > 0;

  return {
    products: data || [],
    lowStockCount,
    hasLowStock,
    loading,
    error,
    refetch,
  };
}

// =====================================================
// EJEMPLO DE USO
// =====================================================

/*
// En un componente:

import { useAuth, useBusinessAccess, usePermissions, usePagination } from '@/hooks/optimized';

function Ventas({ businessId }) {
  // Auth
  const { user, isAuthenticated } = useAuth();
  
  // Verificar acceso
  const { hasAccess, loading: accessLoading, role } = useBusinessAccess(businessId);
  
  // Permisos
  const permissions = usePermissions(role);
  
  // Paginación
  const {
    data: sales,
    loading,
    page,
    totalPages,
    nextPage,
    prevPage,
    refetch
  } = usePagination('sales', { business_id: businessId }, 50);
  
  // Realtime
  useRealtime('sales', { business_id: businessId }, (payload) => {
    // Sale changed
    refetch(); // Recargar datos
  });
  
  // Búsqueda con debounce
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  if (accessLoading) return <Loading />;
  if (!hasAccess) return <Unauthorized />;
  if (!permissions.canViewReports) return <Forbidden />;
  
  return (
    <div>
      <input 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Buscar..."
      />
      
      {loading ? (
        <Loading />
      ) : (
        <SalesList sales={sales} />
      )}
      
      <Pagination
        page={page}
        totalPages={totalPages}
        onNext={nextPage}
        onPrev={prevPage}
      />
    </div>
  );
}
*/
