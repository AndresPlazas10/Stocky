import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Loader2,
  ShieldCheck,
  Wifi
} from 'lucide-react';
import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { listOutboxEvents, runOutboxTick } from '../sync/syncBootstrap.js';

const OUTBOX_POLL_MS = 700;
const OFFLINE_QUEUE_POLL_MS = 900;
const MIN_BLOCKING_MS = 900;
const OUTBOX_ENQUEUED_EVENT = 'stocky:outbox-enqueued';
const OUTBOX_IN_FLIGHT_SCAN_LIMIT = 1000;
const OFFLINE_SYNC_MARKER_KEY = 'stocky.offline_sync.pending_since';
const PHASE_ROTATION_MS = 1400;
const SYNC_PHASES = [
  {
    title: 'Preparando la sincronización',
    description: 'Validando cambios guardados mientras estabas offline.'
  },
  {
    title: 'Subiendo cambios a la nube',
    description: 'Enviando ventas, mesas y actualizaciones pendientes.'
  },
  {
    title: 'Confirmando consistencia',
    description: 'Aplicando confirmaciones para evitar conflictos.'
  }
];

function toValidTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readOfflineSyncMarker() {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    return toValidTimestamp(window.sessionStorage.getItem(OFFLINE_SYNC_MARKER_KEY));
  } catch {
    return null;
  }
}

function writeOfflineSyncMarker(timestampMs) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  const normalizedTimestamp = toValidTimestamp(timestampMs) || Date.now();
  try {
    window.sessionStorage.setItem(OFFLINE_SYNC_MARKER_KEY, String(normalizedTimestamp));
  } catch {
    // no-op
  }
}

function clearOfflineSyncMarker() {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(OFFLINE_SYNC_MARKER_KEY);
  } catch {
    // no-op
  }
}

function isLocalWriteOutboxEvent(event) {
  if (event?.payload?.local_write === true) return true;
  const mutationId = String(event?.mutation_id || '').trim().toLowerCase();
  return mutationId.includes('.local');
}

function eventCreatedAtOrAfter(event, sinceMs) {
  const normalizedSinceMs = toValidTimestamp(sinceMs);
  if (!normalizedSinceMs) return true;

  const createdAtMs = Date.parse(event?.created_at || '');
  if (Number.isFinite(createdAtMs) && createdAtMs >= normalizedSinceMs) return true;

  const updatedAtMs = Date.parse(event?.updated_at || '');
  if (Number.isFinite(updatedAtMs) && updatedAtMs >= normalizedSinceMs) return true;

  if (Number.isFinite(createdAtMs) || Number.isFinite(updatedAtMs)) {
    return false;
  }

  // Si no hay timestamps parseables, considerarlo relevante para no perder sincronización.
  return true;
}

async function hasInFlightOutboxEvents({ sinceMs = null, localWriteOnly = false } = {}) {
  if (!LOCAL_SYNC_CONFIG.enabled) return false;

  try {
    const [pendingEvents, syncingEvents] = await Promise.all([
      listOutboxEvents({ status: 'pending', limit: OUTBOX_IN_FLIGHT_SCAN_LIMIT }),
      listOutboxEvents({ status: 'syncing', limit: OUTBOX_IN_FLIGHT_SCAN_LIMIT })
    ]);

    let inFlightEvents = [
      ...(Array.isArray(pendingEvents) ? pendingEvents : []),
      ...(Array.isArray(syncingEvents) ? syncingEvents : [])
    ];
    if (localWriteOnly) {
      inFlightEvents = inFlightEvents.filter((event) => isLocalWriteOutboxEvent(event));
    }
    if (inFlightEvents.length === 0) return false;

    return inFlightEvents.some((event) => eventCreatedAtOrAfter(event, sinceMs));
  } catch {
    return false;
  }
}

export default function OnlineSyncBlockingAlert() {
  const isOnline = useOnlineStatus();
  const [isBlocking, setIsBlocking] = useState(false);
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);
  const [enqueueSignal, setEnqueueSignal] = useState(0);

  const pollTimerRef = useRef(null);
  const offlineQueueWatchTimerRef = useRef(null);
  const isOnlineRef = useRef(isOnline);
  const wasOfflineRef = useRef(false);
  const offlineHadPendingRef = useRef(false);
  const offlineStartedAtRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const stopSyncPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const stopOfflineQueueWatch = useCallback(() => {
    if (offlineQueueWatchTimerRef.current) {
      clearInterval(offlineQueueWatchTimerRef.current);
      offlineQueueWatchTimerRef.current = null;
    }
  }, []);

  const startOfflineQueueWatch = useCallback(() => {
    stopOfflineQueueWatch();

    const scanOfflineQueue = async () => {
      const hasPending = await hasInFlightOutboxEvents({
        sinceMs: offlineStartedAtRef.current
      });
      if (hasPending) {
        offlineHadPendingRef.current = true;
      }
    };

    scanOfflineQueue().catch(() => {});
    offlineQueueWatchTimerRef.current = setInterval(() => {
      scanOfflineQueue().catch(() => {});
    }, OFFLINE_QUEUE_POLL_MS);
  }, [stopOfflineQueueWatch]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopSyncPolling();
      stopOfflineQueueWatch();
    };
  }, [stopOfflineQueueWatch, stopSyncPolling]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOnline = () => {
      setEnqueueSignal((prev) => prev + 1);
    };

    const handleOffline = () => {
      wasOfflineRef.current = true;
      if (!Number.isFinite(Number(offlineStartedAtRef.current))) {
        offlineStartedAtRef.current = Date.now();
      }
      setEnqueueSignal((prev) => prev + 1);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!LOCAL_SYNC_CONFIG.enabled || typeof window === 'undefined') return undefined;

    const handleOutboxEnqueued = (event) => {
      const enqueuedOnline = event?.detail?.online === true;
      if (!enqueuedOnline || isOnlineRef.current === false) {
        offlineHadPendingRef.current = true;
        const markerSinceMs = toValidTimestamp(offlineStartedAtRef.current) || Date.now();
        offlineStartedAtRef.current = markerSinceMs;
        writeOfflineSyncMarker(markerSinceMs);
        setEnqueueSignal((prev) => prev + 1);
      }
    };

    window.addEventListener(OUTBOX_ENQUEUED_EVENT, handleOutboxEnqueued);
    return () => {
      window.removeEventListener(OUTBOX_ENQUEUED_EVENT, handleOutboxEnqueued);
    };
  }, []);

  useEffect(() => {
    if (!LOCAL_SYNC_CONFIG.enabled) return undefined;

    if (!isOnline) {
      wasOfflineRef.current = true;
      if (!Number.isFinite(Number(offlineStartedAtRef.current))) {
        offlineStartedAtRef.current = Date.now();
      }
      startOfflineQueueWatch();
      stopSyncPolling();
      setIsBlocking(false);
      return undefined;
    }

    const persistedOfflineMarkerMs = readOfflineSyncMarker();
    const shouldEvaluateReconnectSync = (
      wasOfflineRef.current
      || offlineHadPendingRef.current
      || Boolean(persistedOfflineMarkerMs)
    );

    wasOfflineRef.current = false;
    stopOfflineQueueWatch();

    let cancelled = false;

    const guardReconnectSync = async () => {
      if (!shouldEvaluateReconnectSync) {
        if (cancelled || !mountedRef.current) return;
        setIsBlocking(false);
        return;
      }

      let offlineWindowStartMs = (
        toValidTimestamp(offlineStartedAtRef.current)
        || persistedOfflineMarkerMs
      );

      let hasWorkToSync = false;
      if (offlineWindowStartMs) {
        hasWorkToSync = await hasInFlightOutboxEvents({
          sinceMs: offlineWindowStartMs,
          localWriteOnly: true
        });
      } else {
        hasWorkToSync = await hasInFlightOutboxEvents({
          localWriteOnly: true
        });
      }

      const shouldBlock = hasWorkToSync;

      if (cancelled || !mountedRef.current) return;

      if (!shouldBlock) {
        offlineHadPendingRef.current = false;
        offlineStartedAtRef.current = null;
        clearOfflineSyncMarker();
        setIsBlocking(false);
        return;
      }

      if (shouldEvaluateReconnectSync && !offlineWindowStartMs) {
        offlineWindowStartMs = Date.now();
        offlineStartedAtRef.current = offlineWindowStartMs;
        writeOfflineSyncMarker(offlineWindowStartMs);
      }

      const startedAtMs = Date.now();
      setIsBlocking(true);
      runOutboxTick().catch(() => {});

      stopSyncPolling();
      pollTimerRef.current = setInterval(async () => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          if (mountedRef.current) {
            setIsBlocking(false);
          }
          stopSyncPolling();
          return;
        }

        const stillHasWork = await hasInFlightOutboxEvents({
          sinceMs: shouldEvaluateReconnectSync ? offlineWindowStartMs : null,
          localWriteOnly: true
        });
        const elapsedMs = Date.now() - startedAtMs;
        if (!stillHasWork && elapsedMs >= MIN_BLOCKING_MS) {
          if (mountedRef.current) {
            setIsBlocking(false);
          }
          offlineHadPendingRef.current = false;
          offlineStartedAtRef.current = null;
          clearOfflineSyncMarker();
          stopSyncPolling();
        }
      }, OUTBOX_POLL_MS);
    };

    guardReconnectSync().catch(() => {
      if (!cancelled && mountedRef.current) {
        setIsBlocking(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOnline, enqueueSignal, startOfflineQueueWatch, stopOfflineQueueWatch, stopSyncPolling]);

  useEffect(() => {
    if (!isBlocking) {
      setActivePhaseIndex(0);
      return undefined;
    }

    const timer = setInterval(() => {
      setActivePhaseIndex((prev) => (prev + 1) % SYNC_PHASES.length);
    }, PHASE_ROTATION_MS);

    return () => {
      clearInterval(timer);
    };
  }, [isBlocking]);

  if (!isBlocking) return null;

  const activePhase = SYNC_PHASES[activePhaseIndex] || SYNC_PHASES[0];

  return (
    <div
      className="fixed inset-0 z-[300] cursor-wait overflow-hidden bg-slate-950/70 px-4 py-6 backdrop-blur-md"
      role="alertdialog"
      aria-live="assertive"
      aria-busy="true"
      aria-modal="true"
    >
      <div className="pointer-events-none absolute -left-16 top-8 h-64 w-64 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-4 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-300/10 blur-3xl" />

      <div className="relative flex min-h-full items-center justify-center">
        <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-white/[0.06] p-1 shadow-[0_28px_80px_-20px_rgba(15,23,42,0.65)]">
          <div className="rounded-[22px] border border-slate-700/70 bg-slate-900/90 p-5 text-slate-100 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                <Wifi className="h-3.5 w-3.5" />
                Conexion recuperada
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                <CloudUpload className="h-3.5 w-3.5" />
                Sincronizando
              </span>
            </div>

            <div className="flex items-start gap-4">
              <div className="relative mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 via-blue-400/20 to-emerald-400/25 ring-1 ring-white/20">
                <Loader2 className="h-7 w-7 animate-spin text-cyan-100" />
                <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-emerald-300 shadow-[0_0_0_5px_rgba(110,231,183,0.2)]" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold tracking-tight text-white sm:text-2xl">
                  Ya tienes internet, subiendo cambios a la nube
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                  Espere un momento por favor. Estamos terminando de sincronizar para evitar conflictos.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700/80">
                <div className="h-full w-full animate-pulse bg-gradient-to-r from-cyan-300 via-blue-300 to-emerald-300" />
              </div>
              <p className="mt-2 text-xs font-medium text-cyan-100/90">
                {activePhase.title}: {activePhase.description}
              </p>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {SYNC_PHASES.map((phase, index) => {
                const isPast = index < activePhaseIndex;
                const isCurrent = index === activePhaseIndex;
                return (
                  <div
                    key={phase.title}
                    className={`rounded-xl border px-3 py-2 transition-colors ${
                      isCurrent
                        ? 'border-cyan-300/55 bg-cyan-400/10'
                        : isPast
                          ? 'border-emerald-300/45 bg-emerald-400/10'
                          : 'border-slate-600/80 bg-slate-800/55'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isPast ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
                      ) : isCurrent ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-200" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <p className={`text-xs font-semibold ${isCurrent ? 'text-cyan-100' : 'text-slate-200'}`}>
                        {phase.title}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-center gap-1.5">
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-300" />
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-300 [animation-delay:120ms]" />
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-300 [animation-delay:240ms]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
