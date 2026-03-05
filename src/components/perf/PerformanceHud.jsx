import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFramePerformance } from '../../hooks/useFramePerformance.js';

const MAX_EXPORTED_SNAPSHOTS = 180;

function getFpsTone(fps) {
  if (fps >= 55) return 'text-emerald-700';
  if (fps >= 45) return 'text-amber-700';
  return 'text-red-700';
}

function average(values = []) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return total / values.length;
}

function round(value, decimals = 2) {
  const safe = Number(value || 0);
  const factor = 10 ** decimals;
  return Math.round(safe * factor) / factor;
}

async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard no disponible');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('No se pudo copiar');
}

export default function PerformanceHud({
  enabled = false,
  activeSection = 'home',
  sampleWindowMs = 2000,
  onClose = () => {}
}) {
  const stats = useFramePerformance({ enabled, sampleWindowMs });
  const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now());
  const [snapshots, setSnapshots] = useState([]);
  const [exportStatus, setExportStatus] = useState('');

  const updatedAtLabel = useMemo(() => {
    if (!stats.updatedAt) return '-';
    return new Date(stats.updatedAt).toLocaleTimeString();
  }, [stats.updatedAt]);

  useEffect(() => {
    if (!enabled) {
      setSnapshots([]);
      setSessionStartedAt(Date.now());
      setExportStatus('');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !stats.updatedAt) return;
    const snapshot = {
      ...stats,
      section: activeSection
    };
    setSnapshots((prev) => [...prev, snapshot].slice(-MAX_EXPORTED_SNAPSHOTS));
  }, [enabled, stats, activeSection]);

  useEffect(() => {
    if (!exportStatus) return undefined;
    const timer = setTimeout(() => setExportStatus(''), 2500);
    return () => clearTimeout(timer);
  }, [exportStatus]);

  const summary = useMemo(() => {
    if (snapshots.length === 0) {
      return {
        snapshots: 0,
        avgFps: 0,
        avgFrameMs: 0,
        avgP95FrameMs: 0,
        avgSlowFrames60Pct: 0,
        avgSlowFrames30Pct: 0,
        totalLongTasks: 0,
        totalLongTaskTimeMs: 0
      };
    }

    return {
      snapshots: snapshots.length,
      avgFps: round(average(snapshots.map((sample) => sample.fps)), 1),
      avgFrameMs: round(average(snapshots.map((sample) => sample.avgFrameMs)), 2),
      avgP95FrameMs: round(average(snapshots.map((sample) => sample.p95FrameMs)), 2),
      avgSlowFrames60Pct: round(average(snapshots.map((sample) => sample.slowFrames60Pct)), 1),
      avgSlowFrames30Pct: round(average(snapshots.map((sample) => sample.slowFrames30Pct)), 1),
      totalLongTasks: snapshots.reduce((sum, sample) => sum + Number(sample.longTasks || 0), 0),
      totalLongTaskTimeMs: round(
        snapshots.reduce((sum, sample) => sum + Number(sample.longTaskTimeMs || 0), 0),
        1
      )
    };
  }, [snapshots]);

  const handleResetBenchmark = useCallback(() => {
    setSessionStartedAt(Date.now());
    setSnapshots([]);
    setExportStatus('Sesion reiniciada');
  }, []);

  const handleCopyBenchmark = useCallback(async () => {
    try {
      const viewport = typeof window !== 'undefined'
        ? { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 }
        : { width: 0, height: 0, devicePixelRatio: 1 };
      const env = typeof navigator !== 'undefined'
        ? {
          userAgent: navigator.userAgent || '',
          platform: navigator.platform || '',
          language: navigator.language || ''
        }
        : { userAgent: '', platform: '', language: '' };
      const payload = {
        app: 'stocky',
        exportedAt: new Date().toISOString(),
        sessionStartedAt: new Date(sessionStartedAt).toISOString(),
        activeSection,
        sampleWindowMs,
        current: stats,
        summary,
        environment: {
          ...env,
          ...viewport,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
        },
        snapshots
      };

      await copyTextToClipboard(JSON.stringify(payload, null, 2));
      setExportStatus('JSON copiado');
    } catch {
      setExportStatus('No se pudo copiar');
    }
  }, [activeSection, sampleWindowMs, sessionStartedAt, stats, summary, snapshots]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[120] w-[320px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Perf HUD</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
        >
          Ocultar
        </button>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopyBenchmark}
          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Copiar JSON
        </button>
        <button
          type="button"
          onClick={handleResetBenchmark}
          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reset
        </button>
        {exportStatus && (
          <span className="text-[11px] text-slate-500">{exportStatus}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-slate-500">Sección</p>
          <p className="font-semibold text-slate-900">{activeSection}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-slate-500">FPS</p>
          <p className={`font-bold ${getFpsTone(stats.fps)}`}>{stats.fps}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-slate-500">Frame avg</p>
          <p className="font-semibold text-slate-900">{stats.avgFrameMs} ms</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-slate-500">Frame p95</p>
          <p className="font-semibold text-slate-900">{stats.p95FrameMs} ms</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-slate-500">&gt;16.7 ms</p>
          <p className="font-semibold text-slate-900">{stats.slowFrames60Pct}%</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-slate-500">&gt;33.3 ms</p>
          <p className="font-semibold text-slate-900">{stats.slowFrames30Pct}%</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-slate-500">Long tasks</p>
          <p className="font-semibold text-slate-900">{stats.longTasks}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="text-slate-500">LT tiempo</p>
          <p className="font-semibold text-slate-900">{stats.longTaskTimeMs} ms</p>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Muestra: {stats.sampleFrames} frames en {stats.sampleWindowMs || sampleWindowMs} ms
      </p>
      <p className="text-[11px] text-slate-500">
        Sesión: {snapshots.length} snapshots • avg FPS {summary.avgFps} • avg p95 {summary.avgP95FrameMs} ms
      </p>
      <p className="text-[11px] text-slate-500">Actualizado: {updatedAtLabel}</p>
    </div>
  );
}
