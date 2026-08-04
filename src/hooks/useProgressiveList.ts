import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface UseProgressiveListOptions<T> {
  initialCount?: number;
  step?: number;
  rootMargin?: string;
  resetKey?: string;
  preserveOnGrow?: boolean;
  onLoadMore?: () => void;
  canLoadMore?: boolean;
  loading?: boolean;
}

interface UseProgressiveListReturn<T> {
  visibleItems: T[];
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
  hasMoreExternal: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  loadMore: () => void;
}

export function useProgressiveList<T>(
  items: T[] = [],
  {
    initialCount = 20,
    step = 20,
    rootMargin = '320px',
    resetKey = '',
    preserveOnGrow: _preserveOnGrow = false,
    onLoadMore,
    canLoadMore = false,
    loading = false
  }: UseProgressiveListOptions<T> = {}
): UseProgressiveListReturn<T> {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const prevLengthRef = useRef(safeItems.length);
  const prevResetKeyRef = useRef(resetKey);

  useEffect(() => {
    const prevResetKey = prevResetKeyRef.current;
    const resetKeyChanged = prevResetKey !== resetKey;

    if (resetKeyChanged) {
      setVisibleCount(initialCount);
    }

    prevLengthRef.current = safeItems.length;
    prevResetKeyRef.current = resetKey;
  }, [initialCount, resetKey, safeItems.length]);

  const hasMore = visibleCount < safeItems.length;

  const visibleItems = useMemo(
    () => safeItems.slice(0, visibleCount),
    [safeItems, visibleCount]
  );

  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount((prev) => Math.min(prev + step, safeItems.length));
      return;
    }

    if (canLoadMore && typeof onLoadMore === 'function' && !loading) {
      onLoadMore();
    }
  }, [canLoadMore, hasMore, loading, onLoadMore, safeItems.length, step]);

  useEffect(() => {
    if (!hasMore && !canLoadMore) return undefined;
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return undefined;

    const target = sentinelRef.current;
    if (!target) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          loadMore();
        });
      },
      {
        root: null,
        rootMargin,
        threshold: 0
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoadMore, hasMore, loadMore, rootMargin]);

  return {
    visibleItems,
    visibleCount,
    totalCount: safeItems.length,
    hasMore,
    hasMoreExternal: canLoadMore,
    sentinelRef,
    loadMore
  };
}
