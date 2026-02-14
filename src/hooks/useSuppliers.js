import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabase/Client';

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

      const { data, error: fetchError } = await supabase
        .from('suppliers')
        .select('id, business_name, contact_name, email, phone, address')
        .eq('business_id', businessId)
        .order('business_name', { ascending: true });

      if (fetchError) throw fetchError;
      
      setSuppliers(data || []);
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
