import { supabase } from '../supabase/Client.jsx';

export async function logSecurityEvent({ businessId, action, metadata = {} }) {
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedAction = String(action || '').trim();
  if (!normalizedBusinessId || !normalizedAction) return;

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;

    await supabase
      .from('security_audit_logs')
      .insert({
        business_id: normalizedBusinessId,
        user_id: userId,
        action: normalizedAction,
        metadata
      });
  } catch {
    // no-op
  }
}
