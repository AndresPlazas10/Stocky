import { useState, useEffect, useCallback } from 'react';
import { readAdapter } from '../data/adapters/localAdapter.js';

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

      const { data, error: fetchError } = await readAdapter.getProductsWithSupplierByBusiness(businessId);
      if (fetchError) throw fetchError;

      const rawProducts = Array.isArray(data) ? data : [];
      const filteredProducts = activeOnly && !includeInactive
        ? rawProducts.filter((product) => product?.is_active === true)
        : rawProducts;

      const sortedProducts = [...filteredProducts].sort((a, b) => {
        const aValue = a?.[orderBy];
        const bValue = b?.[orderBy];
        const multiplier = orderDirection === 'asc' ? 1 : -1;

        if (aValue === null || aValue === undefined) return 1 * multiplier;
        if (bValue === null || bValue === undefined) return -1 * multiplier;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return (aValue - bValue) * multiplier;
        }

        return String(aValue).localeCompare(String(bValue), 'es', {
          numeric: true,
          sensitivity: 'base'
        }) * multiplier;
      });

      setProducts(sortedProducts);
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
