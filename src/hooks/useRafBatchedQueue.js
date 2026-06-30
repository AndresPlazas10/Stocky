import { startTransition, useCallback, useEffect, useRef } from 'react';
import { logger } from '@/utils/logger';

const MAX_QUEUE_BEFORE_SYNC_FLUSH = 120;

export function useRafBatchedQueue(options = {}) {
  const { useTransition = true } = options;
  const queueRef = useRef([]);
  const frameRef = useRef(null);

  const flush = useCallback(() => {
    const queuedTasks = queueRef.current;
    if (!Array.isArray(queuedTasks) || queuedTasks.length === 0) return;

    queueRef.current = [];

    const runTasks = () => {
      queuedTasks.forEach((task) => {
        if (typeof task !== 'function') return;
        try {
          task();
        } catch (err) {
          logger.warn('hooks:rafBatch:task failed', err);
        }
      });
    };

    if (useTransition && typeof startTransition === 'function') {
      startTransition(runTasks);
      return;
    }

    runTasks();
  }, [useTransition]);

  const enqueue = useCallback((task) => {
    if (typeof task !== 'function') return;

    queueRef.current.push(task);

    if (queueRef.current.length >= MAX_QUEUE_BEFORE_SYNC_FLUSH) {
      if (frameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      flush();
      return;
    }

    if (frameRef.current !== null) return;

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      flush();
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      flush();
    });
  }, [flush]);

  useEffect(() => () => {
    if (frameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    queueRef.current = [];
  }, []);

  return enqueue;
}
