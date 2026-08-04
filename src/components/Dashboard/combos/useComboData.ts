import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/supabase/Client';
import type { Product } from '@/types/product';
import type { Combo } from '@/types/combo';

export function useComboData(businessId: string) {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const loadProducts = useCallback(async () => {
    try {
      const { data } = await supabase.from('products').select('id, name, code, sale_price, stock').eq('business_id', businessId).eq('is_active', true).order('name');
      setProducts((Array.isArray(data) ? data : []) as Product[]);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else if (typeof err === 'object' && err && 'message' in err) setError(String((err as Record<string, unknown>).message));
    }
  }, [businessId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: comboError } = await supabase
        .from('combos')
        .select('*, combo_items(*)')
        .eq('business_id', businessId)
        .order('nombre', { ascending: true });
      if (comboError) throw comboError;
      setCombos((Array.isArray(data) ? data : []) as Combo[]);
      await loadProducts();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else if (typeof err === 'object' && err && 'message' in err) setError(String((err as Record<string, unknown>).message));
    } finally {
      setLoading(false);
    }
  }, [businessId, loadProducts]);

  return {
    combos, setCombos,
    products, setProducts,
    productsById,
    loading, setLoading,
    error, setError,
    loadData, loadProducts,
  };
}
