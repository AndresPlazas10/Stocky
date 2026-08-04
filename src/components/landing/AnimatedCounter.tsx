import { useEffect, useRef, useState, useCallback } from 'react';
import { observeElement } from './sharedObserver';

type AnimatedCounterProps = {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
};

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function AnimatedCounter({
  target,
  suffix = '',
  prefix = '',
  duration = 2000,
  decimals = 0,
  className = '',
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const rafRef = useRef<number>(0);

  const animate = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);
      const current = easedProgress * target;
      setCount(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [target, duration]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const cleanup = observeElement(
      node,
      (entry) => {
        if (entry.isIntersecting) {
          animate();
          cleanup();
        }
      },
      { threshold: 0.3 }
    );

    return () => {
      cleanup();
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {count.toFixed(decimals)}
      {suffix}
    </span>
  );
}
