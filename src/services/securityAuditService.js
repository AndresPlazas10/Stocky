import { supabase } from '../supabase/Client';
import { logger } from '@/utils/logger';

export async function logSecurityEvent({ businessId, action, metadata = {} }) {
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedAction = String(action || '').trim();
  if (!normalizedBusinessId || !normalizedAction) return;

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) return;

    const userId = sessionData.session.user.id;

    const { error } = await supabase
      .from('security_audit_logs')
      .insert({
        business_id: normalizedBusinessId,
        user_id: userId,
        action: normalizedAction,
        metadata
      });

    if (error && error.status !== 403 && error.code !== '42501') {
      logger.error('services:security_audit:log_event_failed', error);
    }
  } catch (err) {
    logger.error('services:security_audit:log_event_failed', err);
  }
}
