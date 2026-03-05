import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useProgressiveList(
  items = [],
  {
    initialCount = 20,
    step = 20,
    rootMargin = '320px',
    resetKey = ''
  } = {}
) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const sentinelRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(initialCount);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [initialCount, resetKey, safeItems.length]);

  const hasMore = visibleCount < safeItems.length;

  const visibleItems = useMemo(
    () => safeItems.slice(0, visibleCount),
    [safeItems, visibleCount]
  );

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + step, safeItems.length));
  }, [safeItems.length, step]);

  useEffect(() => {
    if (!hasMore) return undefined;
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
  }, [hasMore, loadMore, rootMargin]);

  return {
    visibleItems,
    visibleCount,
    totalCount: safeItems.length,
    hasMore,
    sentinelRef,
    loadMore
  };
}
