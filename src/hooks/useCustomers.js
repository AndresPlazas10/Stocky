import { useState, useEffect } from 'react';

/**
 * Hook para gestionar clientes de un negocio
 * NOTA: Tabla 'customers' eliminada - este hook ahora retorna array vacío
 * @param {string} businessId - ID del negocio
 * @returns {object} { customers, loading, error, reload }
 */
export function useCustomers(businessId) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadCustomers = async () => {
    // Tabla customers eliminada - no hacer nada
    setCustomers([]);
    setLoading(false);
    setError(null);
  };

  useEffect(() => {
    loadCustomers();
  }, [businessId]);

  return { 
    customers, 
    loading, 
    error, 
    reload: loadCustomers 
  };
}
