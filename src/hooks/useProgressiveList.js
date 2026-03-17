import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useProgressiveList(
  items = [],
  {
    initialCount = 20,
    step = 20,
    rootMargin = '320px',
    resetKey = '',
    preserveOnGrow = false,
    onLoadMore,
    canLoadMore = false,
    loading = false
  } = {}
) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const sentinelRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const prevLengthRef = useRef(safeItems.length);
  const prevResetKeyRef = useRef(resetKey);

  useEffect(() => {
    const prevLength = prevLengthRef.current;
    const prevResetKey = prevResetKeyRef.current;
    const resetKeyChanged = prevResetKey !== resetKey;
    const lengthChanged = safeItems.length !== prevLength;
    const shouldReset = resetKeyChanged
      || (!preserveOnGrow && lengthChanged)
      || (preserveOnGrow && safeItems.length < prevLength);

    if (shouldReset) {
      setVisibleCount(initialCount);
    }

    prevLengthRef.current = safeItems.length;
    prevResetKeyRef.current = resetKey;
  }, [initialCount, resetKey, safeItems.length, preserveOnGrow]);

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
