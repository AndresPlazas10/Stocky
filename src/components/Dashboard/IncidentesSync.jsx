import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, Trash2 } from 'lucide-react';
import {
  appendSyncAlertAudit,
  clearSyncAlertAudit,
  clearConflictEvents,
  clearConvergenceTimeline,
  listConflictEvents,
  listSyncAlertAudit,
  listConvergenceMetrics,
  listConvergenceTimeline
} from '../../sync/syncBootstrap.js';
import { LOCAL_SYNC_CONFIG } from '../../config/localSync.js';
import { Button } from '../ui/button.jsx';

const CRITICAL_ALERT_DISMISS_STORAGE_PREFIX = 'stocky.sync.critical_alert.dismissed_at.v1';
const ALERT_AUDIT_PREFERENCES_STORAGE_PREFIX = 'stocky.sync.alert_audit.preferences.v1';

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function getCriticalAlertDismissKey(businessId) {
  const normalizedBusinessId = String(businessId || '').trim() || 'global';
  return `${CRITICAL_ALERT_DISMISS_STORAGE_PREFIX}:${normalizedBusinessId}`;
}

function getAlertAuditPreferencesKey(businessId) {
  const normalizedBusinessId = String(businessId || '').trim() || 'global';
  return `${ALERT_AUDIT_PREFERENCES_STORAGE_PREFIX}:${normalizedBusinessId}`;
}

function readCriticalAlertDismissedAt(businessId) {
  if (!canUseLocalStorage()) return '';
  try {
    const value = window.localStorage.getItem(getCriticalAlertDismissKey(businessId));
    return String(value || '').trim();
  } catch {
    return '';
  }
}

function readCriticalAlertDismissState(businessId) {
  const raw = readCriticalAlertDismissedAt(businessId);
  if (!raw) {
    return {
      dismissedAt: '',
      cooldownUntil: ''
    };
  }

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return {
        dismissedAt: String(parsed?.dismissedAt || '').trim(),
        cooldownUntil: String(parsed?.cooldownUntil || '').trim()
      };
    } catch {
      return {
        dismissedAt: '',
        cooldownUntil: ''
      };
    }
  }

  return {
    dismissedAt: raw,
    cooldownUntil: ''
  };
}

function writeCriticalAlertDismissedAt(businessId, value) {
  if (!canUseLocalStorage()) return;
  try {
    const key = getCriticalAlertDismissKey(businessId);
    const normalized = String(value || '').trim();
    if (!normalized) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, normalized);
  } catch {
    // no-op
  }
}

function readAlertAuditPreferences(businessId) {
  if (!canUseLocalStorage()) {
    return {
      action: 'all',
      fromDate: '',
      toDate: '',
      pageSize: 10
    };
  }

  try {
    const raw = window.localStorage.getItem(getAlertAuditPreferencesKey(businessId));
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      action: String(parsed?.action || 'all').trim() || 'all',
      fromDate: String(parsed?.fromDate || '').trim(),
      toDate: String(parsed?.toDate || '').trim(),
      pageSize: [10, 25, 50].includes(Number(parsed?.pageSize)) ? Number(parsed?.pageSize) : 10
    };
  } catch {
    return {
      action: 'all',
      fromDate: '',
      toDate: '',
      pageSize: 10
    };
  }
}

function writeAlertAuditPreferences(businessId, preferences = {}) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(
      getAlertAuditPreferencesKey(businessId),
      JSON.stringify({
        action: String(preferences?.action || 'all').trim() || 'all',
        fromDate: String(preferences?.fromDate || '').trim(),
        toDate: String(preferences?.toDate || '').trim(),
        pageSize: [10, 25, 50].includes(Number(preferences?.pageSize)) ? Number(preferences?.pageSize) : 10
      })
    );
  } catch {
    // no-op
  }
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-CO');
}

function toInputDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toCsvValue(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function inferSeverity(reason = '') {
  const normalized = String(reason || '').toLowerCase();
  if (normalized.includes('reject') || normalized.includes('error') || normalized.includes('conflict')) return 'high';
  if (normalized.includes('retry') || normalized.includes('timeout')) return 'medium';
  return 'low';
}

function filterAlertAuditRows(rows = [], {
  action = 'all',
  fromDate = '',
  toDate = ''
} = {}) {
  const fromTs = fromDate ? Date.parse(`${fromDate}T00:00:00`) : null;
  const toTs = toDate ? Date.parse(`${toDate}T23:59:59`) : null;

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const rowAction = String(row?.action || '').trim();
    const ts = Date.parse(String(row?.created_at || ''));

    if (action !== 'all' && rowAction !== action) return false;
    if (fromTs && Number.isFinite(ts) && ts < fromTs) return false;
    if (toTs && Number.isFinite(ts) && ts > toTs) return false;
    return true;
  });
}

function buildAuditFilterSummary({
  businessId,
  action,
  fromDate,
  toDate,
  pageSize,
  page,
  totalPages,
  visibleCount,
  filteredCount,
  totalCount,
  healthSnapshot
} = {}) {
  const lines = [
    '[Stocky] Estado filtros auditoría',
    `businessId=${String(businessId || '').trim() || 'global'}`,
    `action=${String(action || 'all')}`,
    `from=${String(fromDate || '-')}`,
    `to=${String(toDate || '-')}`,
    `pageSize=${Number(pageSize || 10)}`,
    `page=${Number(page || 1)}/${Number(totalPages || 1)}`,
    `visible=${Number(visibleCount || 0)}`,
    `filtered=${Number(filteredCount || 0)}`,
    `total=${Number(totalCount || 0)}`
  ];

  if (healthSnapshot && typeof healthSnapshot === 'object') {
    lines.push(`health=${String(healthSnapshot.healthStatus || 'ok')}`);
    lines.push(`pending=${Number(healthSnapshot.outboxPendingCount || 0)}`);
    lines.push(`oldestPendingSec=${Number(healthSnapshot.outboxOldestPendingSeconds || 0)}`);
    lines.push(`conflicts=${Number(healthSnapshot.conflicts || 0)}`);
    lines.push(`electricRunning=${Boolean(healthSnapshot.electricRunning)}`);
    if (Array.isArray(healthSnapshot.healthReasons) && healthSnapshot.healthReasons.length > 0) {
      lines.push(`healthReasons=${healthSnapshot.healthReasons.join(' ~ ')}`);
    }
  }

  return lines.join(' | ');
}

async function copyTextToClipboard(text) {
  const value = String(text || '');
  if (!value) return false;

  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
}

function getHealthMeta(status) {
  if (status === 'critical') {
    return {
      label: 'Crítica',
      badgeClass: 'bg-red-100 text-red-700 border-red-200'
    };
  }
  if (status === 'warn') {
    return {
      label: 'Advertencia',
      badgeClass: 'bg-amber-100 text-amber-700 border-amber-200'
    };
  }
  return {
    label: 'Saludable',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };
}

export default function IncidentesSync({ businessId }) {
  const [incidents, setIncidents] = useState([]);
  const [syncMetric, setSyncMetric] = useState(null);
  const [metricTimeline, setMetricTimeline] = useState([]);
  const [alertAuditRows, setAlertAuditRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingAction, setWorkingAction] = useState(null);
  const [error, setError] = useState('');
  const [criticalAlertDismissedAt, setCriticalAlertDismissedAt] = useState('');
  const [criticalAlertCooldownUntil, setCriticalAlertCooldownUntil] = useState('');
  const [search, setSearch] = useState('');
  const [mutationType, setMutationType] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditFromDate, setAuditFromDate] = useState('');
  const [auditToDate, setAuditToDate] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [copyAuditStatus, setCopyAuditStatus] = useState('');
  const criticalThreshold = Math.max(1, Number(LOCAL_SYNC_CONFIG?.criticalAlertConsecutiveThreshold || 3));
  const criticalCooldownMinutes = Math.max(0, Number(LOCAL_SYNC_CONFIG?.criticalAlertCooldownMinutes || 15));
  const auditPageSizeOptions = [10, 25, 50];

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, metrics] = await Promise.all([
        listConflictEvents({ limit: 500 }),
        listConvergenceMetrics()
      ]);
      const [timeline, auditRows] = await Promise.all([
        listConvergenceTimeline({ limit: 20 }),
        listSyncAlertAudit({ businessId, limit: 20 })
      ]);
      setIncidents(Array.isArray(rows) ? rows : []);
      setSyncMetric(Array.isArray(metrics) && metrics.length > 0 ? metrics[0] : null);
      setMetricTimeline(Array.isArray(timeline) ? timeline : []);
      setAlertAuditRows(Array.isArray(auditRows) ? auditRows : []);
      setError('');
    } catch (loadError) {
      setError(loadError?.message || 'No se pudieron cargar los incidentes de sincronización.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadIncidents().catch(() => {});
  }, [loadIncidents, businessId]);

  useEffect(() => {
    const state = readCriticalAlertDismissState(businessId);
    setCriticalAlertDismissedAt(state.dismissedAt);
    setCriticalAlertCooldownUntil(state.cooldownUntil);

    const preferences = readAlertAuditPreferences(businessId);
    setAuditActionFilter(preferences.action);
    setAuditFromDate(preferences.fromDate);
    setAuditToDate(preferences.toDate);
    setAuditPageSize(preferences.pageSize);
  }, [businessId]);

  useEffect(() => {
    if (!criticalAlertDismissedAt && !criticalAlertCooldownUntil) {
      writeCriticalAlertDismissedAt(businessId, '');
      return;
    }

    writeCriticalAlertDismissedAt(businessId, JSON.stringify({
      dismissedAt: criticalAlertDismissedAt,
      cooldownUntil: criticalAlertCooldownUntil
    }));
  }, [businessId, criticalAlertCooldownUntil, criticalAlertDismissedAt]);

  useEffect(() => {
    writeAlertAuditPreferences(businessId, {
      action: auditActionFilter,
      fromDate: auditFromDate,
      toDate: auditToDate,
      pageSize: auditPageSize
    });
  }, [auditActionFilter, auditFromDate, auditPageSize, auditToDate, businessId]);

  const mutationTypes = useMemo(() => {
    return Array.from(new Set(incidents.map((item) => item.mutation_type).filter(Boolean))).sort();
  }, [incidents]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromTs = fromDate ? Date.parse(`${fromDate}T00:00:00`) : null;
    const toTs = toDate ? Date.parse(`${toDate}T23:59:59`) : null;

    return incidents.filter((item) => {
      const itemType = item.mutation_type || '';
      const itemReason = item.reason || '';
      const itemMutationId = item.mutation_id || '';
      const itemSeverity = inferSeverity(itemReason);
      const ts = Date.parse(item.created_at || '');

      if (mutationType !== 'all' && itemType !== mutationType) return false;
      if (severity !== 'all' && itemSeverity !== severity) return false;
      if (fromTs && Number.isFinite(ts) && ts < fromTs) return false;
      if (toTs && Number.isFinite(ts) && ts > toTs) return false;

      if (!term) return true;
      return (
        itemType.toLowerCase().includes(term) ||
        itemReason.toLowerCase().includes(term) ||
        itemMutationId.toLowerCase().includes(term)
      );
    });
  }, [fromDate, incidents, mutationType, search, severity, toDate]);

  const healthMeta = useMemo(() => {
    const status = syncMetric?.healthStatus || 'ok';
    return getHealthMeta(status);
  }, [syncMetric]);

  const auditActionOptions = useMemo(() => {
    return Array.from(new Set(alertAuditRows.map((item) => item.action).filter(Boolean))).sort();
  }, [alertAuditRows]);

  const filteredAlertAuditRows = useMemo(() => {
    return filterAlertAuditRows(alertAuditRows, {
      action: auditActionFilter,
      fromDate: auditFromDate,
      toDate: auditToDate
    });
  }, [alertAuditRows, auditActionFilter, auditFromDate, auditToDate]);

  const auditTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAlertAuditRows.length / auditPageSize));
  }, [filteredAlertAuditRows.length]);

  const paginatedAlertAuditRows = useMemo(() => {
    const safePage = Math.min(Math.max(1, auditPage), auditTotalPages);
    const start = (safePage - 1) * auditPageSize;
    return filteredAlertAuditRows.slice(start, start + auditPageSize);
  }, [auditPage, auditTotalPages, filteredAlertAuditRows]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditActionFilter, auditFromDate, auditToDate, auditPageSize]);

  useEffect(() => {
    if (auditPage > auditTotalPages) {
      setAuditPage(auditTotalPages);
    }
  }, [auditPage, auditTotalPages]);

  useEffect(() => {
    if (!copyAuditStatus) return;
    const timer = setTimeout(() => {
      setCopyAuditStatus('');
    }, 2500);
    return () => clearTimeout(timer);
  }, [copyAuditStatus]);

  const trendSummary = useMemo(() => {
    if (!Array.isArray(metricTimeline) || metricTimeline.length === 0) {
      return {
        pendingDelta: 0,
        conflictDelta: 0,
        isImproving: false,
        hasData: false
      };
    }

    const latest = metricTimeline[0]?.snapshot || {};
    const oldest = metricTimeline[metricTimeline.length - 1]?.snapshot || {};
    const pendingDelta = Number(latest?.outboxPendingCount || 0) - Number(oldest?.outboxPendingCount || 0);
    const conflictDelta = Number(latest?.conflicts || 0) - Number(oldest?.conflicts || 0);

    return {
      pendingDelta,
      conflictDelta,
      isImproving: pendingDelta <= 0 && conflictDelta <= 0,
      hasData: true
    };
  }, [metricTimeline]);

  const criticalAlert = useMemo(() => {
    if (!Array.isArray(metricTimeline) || metricTimeline.length === 0) {
      return {
        consecutiveCritical: 0,
        shouldShow: false,
        latest: null
      };
    }

    let consecutiveCritical = 0;
    for (const row of metricTimeline) {
      const status = String(row?.snapshot?.healthStatus || '').trim();
      if (status !== 'critical') break;
      consecutiveCritical += 1;
    }

    const latest = metricTimeline[0] || null;
    const nowTs = Date.now();
    const dismissedAtTs = Date.parse(String(criticalAlertDismissedAt || ''));
    const latestTs = Date.parse(String(latest?.created_at || ''));
    const cooldownUntilTs = Date.parse(String(criticalAlertCooldownUntil || ''));
    const dismissedCurrent = Number.isFinite(dismissedAtTs)
      && Number.isFinite(latestTs)
      && dismissedAtTs >= latestTs;
    const cooldownActive = Number.isFinite(cooldownUntilTs) && cooldownUntilTs > nowTs;

    return {
      consecutiveCritical,
      shouldShow: consecutiveCritical >= criticalThreshold && !dismissedCurrent && !cooldownActive,
      latest,
      cooldownActive,
      cooldownUntil: criticalAlertCooldownUntil
    };
  }, [criticalAlertCooldownUntil, criticalAlertDismissedAt, criticalThreshold, metricTimeline]);

  useEffect(() => {
    if (criticalAlert.consecutiveCritical < criticalThreshold && criticalAlertDismissedAt) {
      setCriticalAlertDismissedAt('');
      setCriticalAlertCooldownUntil('');
    }
  }, [criticalAlert.consecutiveCritical, criticalAlertDismissedAt, criticalThreshold]);

  const handleExportCsv = useCallback(() => {
    const header = ['created_at', 'business_id', 'mutation_type', 'mutation_id', 'severity', 'reason', 'details'];
    const lines = filtered.map((item) => [
      item.created_at || '',
      item.business_id || '',
      item.mutation_type || '',
      item.mutation_id || '',
      inferSeverity(item.reason),
      item.reason || '',
      item.details ? JSON.stringify(item.details) : ''
    ]);
    const csv = [header, ...lines].map((line) => line.map(toCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `incidentes-sync-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const handleExportAlertAuditCsv = useCallback(async () => {
    const rows = await listSyncAlertAudit({ businessId, limit: 500 });
    const filteredRows = filterAlertAuditRows(rows, {
      action: auditActionFilter,
      fromDate: auditFromDate,
      toDate: auditToDate
    });
    const header = ['created_at', 'business_id', 'action', 'details'];
    const lines = filteredRows.map((item) => [
      item.created_at || '',
      item.business_id || '',
      item.action || '',
      item.details ? JSON.stringify(item.details) : ''
    ]);

    const csv = [header, ...lines].map((line) => line.map(toCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `auditoria-alertas-sync-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [auditActionFilter, auditFromDate, auditToDate, businessId]);

  const handleClearIncidents = useCallback(async () => {
    setWorkingAction('clear');
    try {
      await clearConflictEvents();
      await loadIncidents();
      setError('');
    } catch (clearError) {
      setError(clearError?.message || 'No se pudieron limpiar los incidentes.');
    } finally {
      setWorkingAction(null);
    }
  }, [loadIncidents]);

  const handleClearTimeline = useCallback(async () => {
    setWorkingAction('clear-timeline');
    try {
      await clearConvergenceTimeline();
      await loadIncidents();
      setError('');
    } catch (clearError) {
      setError(clearError?.message || 'No se pudo limpiar el histórico de convergencia.');
    } finally {
      setWorkingAction(null);
    }
  }, [loadIncidents]);

  const logAlertAudit = useCallback(async (action, details = null) => {
    try {
      await appendSyncAlertAudit({
        businessId,
        action,
        details
      });
    } catch {
      // no-op en auditoría; no bloquear UI
    }
  }, [businessId]);

  const handleClearAlertAudit = useCallback(async () => {
    setWorkingAction('clear-alert-audit');
    try {
      await clearSyncAlertAudit({ businessId });
      await loadIncidents();
      setError('');
    } catch (clearError) {
      setError(clearError?.message || 'No se pudo limpiar la auditoría de alertas.');
    } finally {
      setWorkingAction(null);
    }
  }, [businessId, loadIncidents]);

  const handleResetAlertAuditFilters = useCallback(() => {
    setAuditActionFilter('all');
    setAuditFromDate('');
    setAuditToDate('');
    setAuditPageSize(10);
    setAuditPage(1);
  }, []);

  const handleCopyAuditFilterState = useCallback(async () => {
    const text = buildAuditFilterSummary({
      businessId,
      action: auditActionFilter,
      fromDate: auditFromDate,
      toDate: auditToDate,
      pageSize: auditPageSize,
      page: auditPage,
      totalPages: auditTotalPages,
      visibleCount: paginatedAlertAuditRows.length,
      filteredCount: filteredAlertAuditRows.length,
      totalCount: alertAuditRows.length,
      healthSnapshot: syncMetric
    });

    const copied = await copyTextToClipboard(text);
    setCopyAuditStatus(copied ? 'Estado copiado' : 'No se pudo copiar');
  }, [alertAuditRows.length, auditActionFilter, auditFromDate, auditPage, auditPageSize, auditToDate, auditTotalPages, businessId, filteredAlertAuditRows.length, paginatedAlertAuditRows.length, syncMetric]);

  const applyAuditDatePreset = useCallback((days) => {
    const safeDays = Math.max(1, Number(days || 1));
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (safeDays - 1));

    setAuditFromDate(toInputDateValue(start));
    setAuditToDate(toInputDateValue(end));
    setAuditPage(1);
  }, []);

  const handleDismissCriticalAlert = useCallback(() => {
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + (criticalCooldownMinutes * 60 * 1000));
    setCriticalAlertDismissedAt(criticalAlert.latest?.created_at || now.toISOString());
    setCriticalAlertCooldownUntil(cooldownUntil.toISOString());
    logAlertAudit('critical-alert.dismissed', {
      consecutiveCritical: Number(criticalAlert.consecutiveCritical || 0),
      cooldownMinutes: criticalCooldownMinutes,
      cooldownUntil: cooldownUntil.toISOString(),
      pending: Number(criticalAlert.latest?.snapshot?.outboxPendingCount || 0),
      conflicts: Number(criticalAlert.latest?.snapshot?.conflicts || 0)
    });
  }, [criticalAlert.consecutiveCritical, criticalAlert.latest?.created_at, criticalAlert.latest?.snapshot?.conflicts, criticalAlert.latest?.snapshot?.outboxPendingCount, criticalCooldownMinutes, logAlertAudit]);

  const handleReactivateCriticalAlert = useCallback(() => {
    setCriticalAlertDismissedAt('');
    setCriticalAlertCooldownUntil('');
    logAlertAudit('critical-alert.reactivated', {
      reason: 'manual-reactivation'
    });
  }, [logAlertAudit]);

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Incidentes de Sincronizacion</h2>
          <p className="text-sm text-gray-600">Bitacora local de conflictos y rechazos (conflict_log).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => loadIncidents().catch(() => {})}
            disabled={loading || workingAction !== null}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearIncidents}
            disabled={workingAction !== null}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpiar incidentes
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearTimeline}
            disabled={workingAction !== null}
            className="text-gray-700 hover:text-gray-900"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpiar histórico
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearAlertAudit}
            disabled={workingAction !== null}
            className="text-gray-700 hover:text-gray-900"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpiar auditoría
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleExportAlertAuditCsv().catch(() => {})}
            disabled={filteredAlertAuditRows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar auditoría CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por tipo, reason o mutation_id"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2"
        />
        <select
          value={mutationType}
          onChange={(event) => setMutationType(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">Todos los tipos</option>
          {mutationTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">Severidad: todas</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="inline-flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {criticalAlert.shouldShow && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-start gap-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">Alerta automática: convergencia en estado crítico</p>
              <p>
                {criticalAlert.consecutiveCritical} snapshots consecutivos en crítico.
                Último backlog: {Number(criticalAlert.latest?.snapshot?.outboxPendingCount || 0)} pendientes,
                conflictos: {Number(criticalAlert.latest?.snapshot?.conflicts || 0)}.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={handleDismissCriticalAlert}>
            Descartar
          </Button>
        </div>
      )}

      {!criticalAlert.shouldShow && criticalAlert.cooldownActive && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <span>
            Alerta crítica en cooldown hasta {formatDate(criticalAlert.cooldownUntil)}.
          </span>
          <Button type="button" variant="outline" onClick={handleReactivateCriticalAlert}>
            Reactivar alerta ahora
          </Button>
        </div>
      )}

      {syncMetric && (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
            <div>
              <p className="text-xs uppercase text-gray-500">Semáforo de convergencia</p>
              <p className="text-sm text-gray-700">
                {Array.isArray(syncMetric.healthReasons) && syncMetric.healthReasons.length > 0
                  ? syncMetric.healthReasons.join(' · ')
                  : 'Sin alertas activas.'}
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${healthMeta.badgeClass}`}>
              {healthMeta.label}
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase text-gray-500">Runtime</p>
            <p className="text-sm font-semibold text-gray-900">
              {syncMetric.enabled ? 'Activo' : 'Desactivado'} · {syncMetric.dbMode || 'disabled'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase text-gray-500">Electric</p>
            <p className="text-sm font-semibold text-gray-900">
              {syncMetric.electricRunning ? 'Running' : 'Stopped'} · ticks {Number(syncMetric.electricTicks || 0)}
            </p>
            <p className="text-xs text-gray-600">
              pulled {Number(syncMetric.electricPulled || 0)} · upserted {Number(syncMetric.electricUpserted || 0)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase text-gray-500">Materialización</p>
            <p className="text-sm font-semibold text-gray-900">
              shapes {Number(syncMetric.materializedShapes || 0)} · rows {Number(syncMetric.materializedRows || 0)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs uppercase text-gray-500">Outbox</p>
            <p className="text-sm font-semibold text-gray-900">
              pendientes {Number(syncMetric.outboxPendingCount || 0)}
            </p>
            <p className="text-xs text-gray-600">
              oldest {Number(syncMetric.outboxOldestPendingSeconds || 0)}s · conflicts {Number(syncMetric.conflicts || 0)}
            </p>
          </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase text-gray-500">Tendencia (últimos {metricTimeline.length} snapshots)</p>
              {trendSummary.hasData && (
                <span className={`text-xs font-medium ${trendSummary.isImproving ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {trendSummary.isImproving ? 'Mejorando' : 'Atención'}
                </span>
              )}
            </div>
            {metricTimeline.length === 0 ? (
              <p className="text-xs text-gray-600">Sin historial todavía.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 md:grid-cols-4">
                  <div>
                    <p className="text-gray-500">Δ pendientes</p>
                    <p className="font-semibold">{trendSummary.pendingDelta > 0 ? `+${trendSummary.pendingDelta}` : trendSummary.pendingDelta}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Δ conflictos</p>
                    <p className="font-semibold">{trendSummary.conflictDelta > 0 ? `+${trendSummary.conflictDelta}` : trendSummary.conflictDelta}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Último estado</p>
                    <p className="font-semibold">{getHealthMeta(metricTimeline[0]?.snapshot?.healthStatus || 'ok').label}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Actualizado</p>
                    <p className="font-semibold">{formatDate(metricTimeline[0]?.created_at)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left uppercase tracking-wide text-gray-500">
                        <th className="px-2 py-1">Fecha</th>
                        <th className="px-2 py-1">Estado</th>
                        <th className="px-2 py-1">Pendientes</th>
                        <th className="px-2 py-1">Oldest(s)</th>
                        <th className="px-2 py-1">Conflictos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricTimeline.slice(0, 10).map((row) => {
                        const snap = row?.snapshot || {};
                        const meta = getHealthMeta(snap.healthStatus || 'ok');
                        return (
                          <tr key={row.id} className="border-t border-gray-200 text-gray-700">
                            <td className="px-2 py-1">{formatDate(row.created_at)}</td>
                            <td className="px-2 py-1">{meta.label}</td>
                            <td className="px-2 py-1">{Number(snap.outboxPendingCount || 0)}</td>
                            <td className="px-2 py-1">{Number(snap.outboxOldestPendingSeconds || 0)}</td>
                            <td className="px-2 py-1">{Number(snap.conflicts || 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase text-gray-500">Auditoría de alertas (operador)</p>
              <span
                className="text-xs text-gray-500"
                title="Visibles: filas en la página actual. Filtrados: filas que cumplen filtros. Total: eventos cargados para el negocio."
              >
                {paginatedAlertAuditRows.length} visibles · {filteredAlertAuditRows.length} filtrados / {alertAuditRows.length} total
              </span>
            </div>
            <p className="mb-2 text-[11px] text-gray-500">
              Visibles = página actual · Filtrados = coincidencias de filtros · Total = registros cargados del negocio.
            </p>
            <div className="mb-2 grid gap-2 md:grid-cols-5">
              <select
                value={auditActionFilter}
                onChange={(event) => setAuditActionFilter(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs"
              >
                <option value="all">Acción: todas</option>
                {auditActionOptions.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
              <input
                type="date"
                value={auditFromDate}
                onChange={(event) => setAuditFromDate(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs"
              />
              <input
                type="date"
                value={auditToDate}
                onChange={(event) => setAuditToDate(event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs"
              />
              <select
                value={String(auditPageSize)}
                onChange={(event) => setAuditPageSize(Number(event.target.value) || 10)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs"
              >
                {auditPageSizeOptions.map((size) => (
                  <option key={size} value={String(size)}>Página: {size}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={handleResetAlertAuditFilters}
              >
                Restablecer filtros
              </Button>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => applyAuditDatePreset(1)}>
                Hoy
              </Button>
              <Button type="button" variant="outline" onClick={() => applyAuditDatePreset(7)}>
                7 días
              </Button>
              <Button type="button" variant="outline" onClick={() => applyAuditDatePreset(30)}>
                30 días
              </Button>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                pageSize: {auditPageSize}
              </span>
              {auditActionFilter !== 'all' && (
                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">
                  acción: {auditActionFilter}
                </span>
              )}
              {auditFromDate && (
                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                  desde: {auditFromDate}
                </span>
              )}
              {auditToDate && (
                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                  hasta: {auditToDate}
                </span>
              )}
              {auditActionFilter === 'all' && !auditFromDate && !auditToDate && (
                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                  sin filtros activos
                </span>
              )}
              <Button type="button" variant="outline" onClick={() => handleCopyAuditFilterState().catch(() => {})}>
                Copiar estado filtros
              </Button>
              {copyAuditStatus && (
                <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700">
                  {copyAuditStatus}
                </span>
              )}
            </div>
            {filteredAlertAuditRows.length === 0 ? (
              <p className="text-xs text-gray-600">Sin acciones registradas.</p>
            ) : (
              <div className="space-y-2">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left uppercase tracking-wide text-gray-500">
                        <th className="px-2 py-1">Fecha</th>
                        <th className="px-2 py-1">Acción</th>
                        <th className="px-2 py-1">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAlertAuditRows.map((row) => (
                        <tr key={row.id} className="border-t border-gray-200 text-gray-700">
                          <td className="px-2 py-1">{formatDate(row.created_at)}</td>
                          <td className="px-2 py-1">{row.action || '-'}</td>
                          <td className="max-w-[420px] truncate px-2 py-1" title={row.details ? JSON.stringify(row.details) : ''}>
                            {row.details ? JSON.stringify(row.details) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-end gap-2 text-xs">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                    disabled={auditPage <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-gray-600">Página {auditPage} de {auditTotalPages}</span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAuditPage((prev) => Math.min(auditTotalPages, prev + 1))}
                    disabled={auditPage >= auditTotalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Severidad</th>
              <th className="px-3 py-2">Mutation ID</th>
              <th className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                  No hay incidentes para los filtros actuales.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const itemSeverity = inferSeverity(item.reason);
                return (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatDate(item.created_at)}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{item.mutation_type || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={[
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        itemSeverity === 'high' ? 'bg-red-100 text-red-700' : '',
                        itemSeverity === 'medium' ? 'bg-amber-100 text-amber-700' : '',
                        itemSeverity === 'low' ? 'bg-slate-100 text-slate-700' : ''
                      ].join(' ')}>
                        {itemSeverity === 'high' ? 'Alta' : itemSeverity === 'medium' ? 'Media' : 'Baja'}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-gray-700" title={item.mutation_id || ''}>
                      {item.mutation_id || '-'}
                    </td>
                    <td className="max-w-[500px] truncate px-3 py-2 text-gray-700" title={item.reason || ''}>
                      {item.reason || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
