import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, DatabaseZap, AlertTriangle } from 'lucide-react';
import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import {
  clearConflictEvents,
  clearLocalReadCache,
  getLocalSyncHealth,
  listConflictEvents,
  runOutboxTick
} from '../sync/syncBootstrap.js';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Button } from './ui/button.jsx';

function formatSeconds(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

function formatMs(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatPct(value) {
  const pct = Number(value);
  if (!Number.isFinite(pct)) return '0%';
  return `${pct.toFixed(1)}%`;
}

export function LocalSyncHealthPanel({ businessId, onRebuildWarmup, onRiskChange, onReconcileTables }) {
  const [health, setHealth] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workingAction, setWorkingAction] = useState(null);
  const [actionError, setActionError] = useState(null);
  const enabled = Boolean(LOCAL_SYNC_CONFIG.enabled);

  const loadHealth = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const nextHealth = await getLocalSyncHealth();
      const recentConflicts = await listConflictEvents({ limit: 8 });
      setHealth(nextHealth || null);
      setConflicts(Array.isArray(recentConflicts) ? recentConflicts : []);
      setActionError(null);
    } catch (error) {
      setActionError(error?.message || 'No se pudo leer la salud local-first.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    loadHealth().catch(() => {});
    const timer = setInterval(() => {
      loadHealth().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [enabled, loadHealth]);

  const handleResyncNow = useCallback(async () => {
    setWorkingAction('resync');
    setActionError(null);
    try {
      await runOutboxTick();
      await loadHealth();
    } catch (error) {
      setActionError(error?.message || 'No se pudo ejecutar la sincronización manual.');
    } finally {
      setWorkingAction(null);
    }
  }, [loadHealth]);

  const handleRebuildCache = useCallback(async () => {
    setWorkingAction('rebuild');
    setActionError(null);
    try {
      await clearLocalReadCache();
      if (typeof onRebuildWarmup === 'function' && businessId) {
        await onRebuildWarmup(businessId);
      }
      await runOutboxTick();
      await loadHealth();
    } catch (error) {
      setActionError(error?.message || 'No se pudo reconstruir la caché local.');
    } finally {
      setWorkingAction(null);
    }
  }, [businessId, loadHealth, onRebuildWarmup]);

  const risk = useMemo(() => {
    if (!health) return 'unknown';
    const pending = Number(health?.pendingCount || 0);
    const oldest = Number(health?.outboxOldestPendingSeconds || 0);
    const rejectRatePct = Number(health?.outboxRates?.rejectRatePct || 0);
    if (pending > 0 && oldest > 300) return 'high';
    if (rejectRatePct > 2) return 'high';
    if (pending > 0 || rejectRatePct > 0) return 'medium';
    return 'low';
  }, [health]);

  useEffect(() => {
    if (typeof onRiskChange === 'function' && risk !== 'unknown') {
      onRiskChange(risk);
    }
  }, [risk, onRiskChange]);

  const handleClearConflicts = useCallback(async () => {
    setWorkingAction('clear-conflicts');
    setActionError(null);
    try {
      await clearConflictEvents();
      await loadHealth();
    } catch (error) {
      setActionError(error?.message || 'No se pudo limpiar la bitácora de incidentes.');
    } finally {
      setWorkingAction(null);
    }
  }, [loadHealth]);

  const handleReconcileTables = useCallback(async () => {
    if (typeof onReconcileTables !== 'function') return;
    setWorkingAction('reconcile-tables');
    setActionError(null);
    try {
      await onReconcileTables();
      await loadHealth();
    } catch (error) {
      setActionError(error?.message || 'No se pudo ejecutar la reconciliación de mesas.');
    } finally {
      setWorkingAction(null);
    }
  }, [loadHealth, onReconcileTables]);

  if (!enabled) return null;

  return (
    <Card className="border-accent-200 bg-accent-50/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="inline-flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent-700" />
            Salud Local-First
          </span>
          <span className={[
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            risk === 'high' ? 'bg-red-100 text-red-700' : '',
            risk === 'medium' ? 'bg-amber-100 text-amber-700' : '',
            risk === 'low' ? 'bg-green-100 text-green-700' : '',
            risk === 'unknown' ? 'bg-slate-100 text-slate-700' : ''
          ].join(' ')}>
            {risk === 'high' ? 'Riesgo alto' : risk === 'medium' ? 'Riesgo medio' : risk === 'low' ? 'Saludable' : 'Sin datos'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-accent-200 bg-white p-3">
            <p className="text-xs text-gray-500">Adapter</p>
            <p className="text-sm font-semibold text-gray-800">{health?.adapter || '-'}</p>
          </div>
          <div className="rounded-lg border border-accent-200 bg-white p-3">
            <p className="text-xs text-gray-500">Outbox pendiente</p>
            <p className="text-sm font-semibold text-gray-800">{Number(health?.pendingCount || 0)}</p>
          </div>
          <div className="rounded-lg border border-accent-200 bg-white p-3">
            <p className="text-xs text-gray-500">Más antiguo</p>
            <p className="text-sm font-semibold text-gray-800">{formatSeconds(health?.outboxOldestPendingSeconds)}</p>
          </div>
          <div className="rounded-lg border border-accent-200 bg-white p-3">
            <p className="text-xs text-gray-500">Reject rate</p>
            <p className="text-sm font-semibold text-gray-800">{formatPct(health?.outboxRates?.rejectRatePct)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-accent-200 bg-white p-3">
            <p className="text-xs text-gray-500">Ack rate</p>
            <p className="text-sm font-semibold text-gray-800">{formatPct(health?.outboxRates?.ackRatePct)}</p>
          </div>
          <div className="rounded-lg border border-accent-200 bg-white p-3">
            <p className="text-xs text-gray-500">Convergencia p95</p>
            <p className="text-sm font-semibold text-gray-800">{formatMs(health?.convergence?.p95Ms)}</p>
          </div>
          <div className="rounded-lg border border-accent-200 bg-white p-3">
            <p className="text-xs text-gray-500">Convergencia avg</p>
            <p className="text-sm font-semibold text-gray-800">{formatMs(health?.convergence?.avgMs)}</p>
          </div>
          <div className="rounded-lg border border-accent-200 bg-white p-3">
            <p className="text-xs text-gray-500">Entradas caché</p>
            <p className="text-sm font-semibold text-gray-800">{Number(health?.cacheCount || 0)}</p>
          </div>
        </div>

        {actionError && (
          <div className="inline-flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {actionError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handleResyncNow}
            disabled={workingAction !== null}
            className="h-9"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${workingAction === 'resync' ? 'animate-spin' : ''}`} />
            Re-sync now
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRebuildCache}
            disabled={workingAction !== null}
            className="h-9"
          >
            <DatabaseZap className={`mr-2 h-4 w-4 ${workingAction === 'rebuild' ? 'animate-pulse' : ''}`} />
            Rebuild cache
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => loadHealth().catch(() => {})}
            disabled={loading || workingAction !== null}
            className="h-9"
          >
            {loading ? 'Actualizando...' : 'Actualizar métricas'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearConflicts}
            disabled={loading || workingAction !== null}
            className="h-9 text-red-600 hover:text-red-700"
          >
            Limpiar incidentes
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleReconcileTables}
            disabled={workingAction !== null || typeof onReconcileTables !== 'function'}
            className="h-9"
          >
            Reconciliar mesas
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Incidentes recientes</p>
          {conflicts.length === 0 ? (
            <div className="rounded-md border border-accent-200 bg-white p-3 text-sm text-gray-600">
              Sin incidentes recientes en conflict_log.
            </div>
          ) : (
            <div className="space-y-2">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-amber-800">{conflict.mutation_type || 'unknown.mutation'}</span>
                    <span className="text-xs text-amber-700">{new Date(conflict.created_at).toLocaleString('es-CO')}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-700">{conflict.reason || 'Sin detalle de error.'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default LocalSyncHealthPanel;
