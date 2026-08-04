import { logger } from '@/utils/logger';

const CRITICAL_ALERT_DISMISS_STORAGE_PREFIX = 'stocky.sync.critical_alert.dismissed_at.v1';
const ALERT_AUDIT_PREFERENCES_STORAGE_PREFIX = 'stocky.sync.alert_audit.preferences.v1';

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function getCriticalAlertDismissKey(businessId: string) {
  return `${CRITICAL_ALERT_DISMISS_STORAGE_PREFIX}:${String(businessId || '').trim() || 'global'}`;
}

function getAlertAuditPreferencesKey(businessId: string) {
  return `${ALERT_AUDIT_PREFERENCES_STORAGE_PREFIX}:${String(businessId || '').trim() || 'global'}`;
}

export function readCriticalAlertDismissedAt(businessId: string) {
  if (!canUseLocalStorage()) return '';
  try {
    return String(window.localStorage.getItem(getCriticalAlertDismissKey(businessId)) || '').trim();
  } catch (err) {
    logger.warn('incidentes_sync:read_critical_alert_dismissed failed', err);
    return '';
  }
}

export function readCriticalAlertDismissState(businessId: string): { dismissedAt: string; cooldownUntil: string } {
  const raw = readCriticalAlertDismissedAt(businessId);
  if (!raw) return { dismissedAt: '', cooldownUntil: '' };
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return {
        dismissedAt: String(parsed?.dismissedAt || '').trim(),
        cooldownUntil: String(parsed?.cooldownUntil || '').trim()
      };
    } catch (err) {
      logger.warn('incidentes_sync:parse_critical_alert_state failed', err);
      return { dismissedAt: '', cooldownUntil: '' };
    }
  }
  return { dismissedAt: raw, cooldownUntil: '' };
}

export function writeCriticalAlertDismissedAt(businessId: string, value: string) {
  if (!canUseLocalStorage()) return;
  try {
    if (!value) { window.localStorage.removeItem(getCriticalAlertDismissKey(businessId)); return; }
    window.localStorage.setItem(getCriticalAlertDismissKey(businessId), value);
  } catch (err) { logger.warn('incidentes_sync:write_critical_alert_dismissed failed', err); }
}

export function readAlertAuditPreferences(businessId: string): { action: string; fromDate: string; toDate: string; pageSize: number } {
  if (!canUseLocalStorage()) return { action: 'all', fromDate: '', toDate: '', pageSize: 10 };
  try {
    const raw = window.localStorage.getItem(getAlertAuditPreferencesKey(businessId));
    if (!raw) return { action: 'all', fromDate: '', toDate: '', pageSize: 10 };
    const parsed = JSON.parse(raw);
    return {
      action: String(parsed?.action || 'all').trim(),
      fromDate: String(parsed?.fromDate || '').trim(),
      toDate: String(parsed?.toDate || '').trim(),
      pageSize: Math.max(1, Math.min(100, Number(parsed?.pageSize || 10)))
    };
  } catch (err) { return { action: 'all', fromDate: '', toDate: '', pageSize: 10 }; }
}

export function writeAlertAuditPreferences(businessId: string, preferences: Record<string, unknown>) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(getAlertAuditPreferencesKey(businessId), JSON.stringify(preferences));
  } catch (err) { logger.warn('incidentes_sync:write_alert_audit_preferences failed', err); }
}
