import { useCallback, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import { normalizeRole } from '../inventoryUtils';

export function useInventoryPermissions(
  businessId: string,
  userId: string,
  source: 'owner' | 'employee',
) {
  const [canManageProducts, setCanManageProducts] = useState(source === 'owner');
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  const checkPermissions = useCallback(async () => {
    if (source === 'owner') {
      setCanManageProducts(true);
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
      setCanManageProducts(role === 'admin' || role.includes('admin'));
    } catch {
      setCanManageProducts(false);
    } finally {
      setCheckingPermissions(false);
    }
  }, [businessId, source, userId]);

  return {
    canManageProducts,
    checkingPermissions,
    checkPermissions,
  };
}
