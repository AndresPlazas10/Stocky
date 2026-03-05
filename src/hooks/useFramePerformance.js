import { useEffect, useRef, useState } from 'react';

const DEFAULT_SAMPLE_WINDOW_MS = 2000;
const FRAME_BUDGET_60_FPS_MS = 16.7;
const FRAME_BUDGET_30_FPS_MS = 33.3;

const emptyStats = {
  fps: 0,
  avgFrameMs: 0,
  p95FrameMs: 0,
  slowFrames60Pct: 0,
  slowFrames30Pct: 0,
  sampleFrames: 0,
  sampleWindowMs: 0,
  longTasks: 0,
  longTaskTimeMs: 0,
  updatedAt: null
};

const round = (value, decimals = 1) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
};

const percentile = (values = [], p = 0.95) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1));
  return sorted[index] || 0;
};

export function useFramePerformance({
  enabled = false,
  sampleWindowMs = DEFAULT_SAMPLE_WINDOW_MS
} = {}) {
  const [stats, setStats] = useState(emptyStats);
  const rafRef = useRef(null);
  const prevTsRef = useRef(0);
  const sampleStartTsRef = useRef(0);
  const frameTimesRef = useRef([]);
  const longTaskCountRef = useRef(0);
  const longTaskTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setStats(emptyStats);
      prevTsRef.current = 0;
      sampleStartTsRef.current = 0;
      frameTimesRef.current = [];
      longTaskCountRef.current = 0;
      longTaskTimeRef.current = 0;
      return undefined;
    }

    let observer = null;
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            longTaskCountRef.current += 1;
            longTaskTimeRef.current += Number(entry?.duration || 0);
          });
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch {
        observer = null;
      }
    }

    const onFrame = (timestamp) => {
      if (sampleStartTsRef.current === 0) {
        sampleStartTsRef.current = timestamp;
      }

      if (prevTsRef.current > 0) {
        const dt = timestamp - prevTsRef.current;
        if (dt > 0 && dt < 1000) {
          frameTimesRef.current.push(dt);
        }
      }
      prevTsRef.current = timestamp;

      const elapsed = timestamp - sampleStartTsRef.current;
      if (elapsed >= sampleWindowMs) {
        const frameTimes = frameTimesRef.current;
        const frameCount = frameTimes.length;
        const avgFrameMs = frameCount > 0
          ? frameTimes.reduce((sum, value) => sum + value, 0) / frameCount
          : 0;
        const p95FrameMs = percentile(frameTimes, 0.95);
        const fps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0;
        const slowFrames60 = frameCount > 0
          ? (frameTimes.filter((value) => value > FRAME_BUDGET_60_FPS_MS).length / frameCount) * 100
          : 0;
        const slowFrames30 = frameCount > 0
          ? (frameTimes.filter((value) => value > FRAME_BUDGET_30_FPS_MS).length / frameCount) * 100
          : 0;

        setStats({
          fps: round(fps, 1),
          avgFrameMs: round(avgFrameMs, 2),
          p95FrameMs: round(p95FrameMs, 2),
          slowFrames60Pct: round(slowFrames60, 1),
          slowFrames30Pct: round(slowFrames30, 1),
          sampleFrames: frameCount,
          sampleWindowMs: round(elapsed, 0),
          longTasks: longTaskCountRef.current,
          longTaskTimeMs: round(longTaskTimeRef.current, 1),
          updatedAt: Date.now()
        });

        frameTimesRef.current = [];
        sampleStartTsRef.current = timestamp;
        longTaskCountRef.current = 0;
        longTaskTimeRef.current = 0;
      }

      rafRef.current = window.requestAnimationFrame(onFrame);
    };

    rafRef.current = window.requestAnimationFrame(onFrame);

    return () => {
      if (rafRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }, [enabled, sampleWindowMs]);

  return stats;
}
