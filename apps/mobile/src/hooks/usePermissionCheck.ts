import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';

function normalizeRole(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function usePermissionCheck(
  session: Session | null,
  source: 'owner' | 'employee' | string | null | undefined,
) {
  const [canManage, setCanManage] = useState(source === 'owner');
  const [canDelete, setCanDelete] = useState(source === 'owner');
  const [checking, setChecking] = useState(false);

  const checkPermissions = useCallback(async () => {
    if (source === 'owner') {
      setCanManage(true);
      setCanDelete(true);
      return;
    }
    if (!session?.user?.id) {
      setCanManage(false);
      setCanDelete(false);
      return;
    }
    setChecking(true);
    try {
      const client = getSupabaseClient();
      const { data } = await client
        .from('employees')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .maybeSingle();
      const role = normalizeRole(data?.role);
      const isAdmin = role === 'admin';
      setCanManage(isAdmin);
      setCanDelete(isAdmin);
    } catch {
      setCanManage(false);
      setCanDelete(false);
    } finally {
      setChecking(false);
    }
  }, [session?.user?.id, source]);

  useEffect(() => {
    void checkPermissions();
  }, [checkPermissions]);

  return { canManage, canDelete, checking };
}
