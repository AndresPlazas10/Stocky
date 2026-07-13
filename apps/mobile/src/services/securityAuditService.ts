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

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData?.session) return;

    const userId = String(params.userId || sessionData.session.user.id || '').trim();
    if (!userId) return;

    const { error } = await client.from('security_audit_logs').insert({
      business_id: businessId,
      user_id: userId,
      action,
      metadata: params.metadata || {},
    });

    if (error && error.status !== 403 && error.code !== '42501') {
      console.error('security_audit:log_event_failed', error);
    }
  } catch {
    // no-op
  }
}
