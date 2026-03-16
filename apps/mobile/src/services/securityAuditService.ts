import { getSupabaseClient } from '../lib/supabase';

export async function logSecurityEvent(params: {
  businessId?: string | null;
  userId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const businessId = String(params.businessId || '').trim();
  const action = String(params.action || '').trim();
  if (!businessId || !action) return;

  try {
    const client = getSupabaseClient();
    const userId = String(params.userId || '').trim();
    if (!userId) return;

    await client
      .from('security_audit_logs')
      .insert({
        business_id: businessId,
        user_id: userId,
        action,
        metadata: params.metadata || {},
      });
  } catch {
    // no-op
  }
}
