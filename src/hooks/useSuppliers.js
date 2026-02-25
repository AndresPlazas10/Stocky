import { useState, useEffect, useCallback } from 'react';
import { readAdapter } from '../data/adapters/localAdapter.js';

/**
 * Hook para gestionar proveedores de un negocio
 * @param {string} businessId - ID del negocio
 * @returns {object} { suppliers, loading, error, reload }
 */
export function useSuppliers(businessId) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSuppliers = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await readAdapter.getSuppliersByBusinessWithSelect(
        businessId,
        'id, business_name, contact_name, email, phone, address'
      );

      if (fetchError) throw fetchError;

      const sortedSuppliers = [...(data || [])].sort((a, b) =>
        String(a?.business_name || '').localeCompare(String(b?.business_name || ''), 'es', {
          numeric: true,
          sensitivity: 'base'
        })
      );

      setSuppliers(sortedSuppliers);
    } catch (err) {
      setError(err.message);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  return { 
    suppliers, 
    loading, 
    error, 
    reload: loadSuppliers 
  };
}
