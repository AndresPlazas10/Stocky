import { useState, useCallback } from 'react';
import { logger } from '@/utils/logger';
import {
  listConflictEvents, listSyncAlertAudit, listConvergenceMetrics, listConvergenceTimeline,
} from '@/sync/syncBootstrap';

export function useSyncIncidentsLoader(businessId: string) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [syncMetric, setSyncMetric] = useState<any>(null);
  const [metricTimeline, setMetricTimeline] = useState<any[]>([]);
  const [alertAuditRows, setAlertAuditRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const [events, metrics, timeline, audit] = await Promise.all([
        listConflictEvents().catch(() => []),
        listConvergenceMetrics().catch(() => null),
        listConvergenceTimeline().catch(() => []),
        listSyncAlertAudit({ businessId }).catch(() => []),
      ]);
      setIncidents(Array.isArray(events) ? events : []);
      setSyncMetric(metrics);
      setMetricTimeline(Array.isArray(timeline) ? timeline : []);
      setAlertAuditRows(Array.isArray(audit) ? audit : []);
    } catch (err: any) {
      logger.error('sync_incidents:load failed', err);
      setError(err.message || 'Error cargando incidentes');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  return {
    incidents, setIncidents,
    syncMetric, setSyncMetric,
    metricTimeline, setMetricTimeline,
    alertAuditRows, setAlertAuditRows,
    loading, setLoading,
    error, setError,
    loadIncidents,
  };
}
