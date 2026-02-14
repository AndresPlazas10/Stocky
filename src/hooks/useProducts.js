import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabase/Client';

/**
 * Hook para gestionar productos de un negocio
 * @param {string} businessId - ID del negocio
 * @param {object} options - Opciones de configuración
 * @returns {object} { products, loading, error, reload }
 */
export function useProducts(businessId, options = {}) {
  const { 
    activeOnly = true,
    includeInactive = false,
    orderBy = 'name',
    orderDirection = 'asc'
  } = options;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProducts = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('products')
        .select('id, code, name, category, purchase_price, sale_price, stock, min_stock, unit, supplier_id, is_active')
        .eq('business_id', businessId);

      if (activeOnly && !includeInactive) {
        query = query.eq('is_active', true);
      }

      query = query.order(orderBy, { ascending: orderDirection === 'asc' });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      setProducts(data || []);
    } catch (err) {
      setError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, activeOnly, includeInactive, orderBy, orderDirection]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return { 
    products, 
    loading, 
    error, 
    reload: loadProducts,
    refetch: loadProducts
  };
}
