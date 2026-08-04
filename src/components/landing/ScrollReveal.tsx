import { useEffect, useRef, useState, createElement, type ReactNode, type ElementType } from 'react';
import { observeElement } from './sharedObserver';

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
  threshold?: number;
  once?: boolean;
  as?: ElementType;
};

export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  threshold = 0.15,
  once = true,
  as: Tag = 'div',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const cleanup = observeElement(
      node,
      (entry) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) cleanup();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    return cleanup;
  }, [threshold, once]);

  const directionMap = {
    up: 'translateY(16px)',
    left: 'translateX(-16px)',
    right: 'translateX(16px)',
  };

  return createElement(
    Tag,
    {
      ref,
      className,
      style: {
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate(0, 0)' : directionMap[direction],
        transition: `opacity 0.5s ease-out, transform 0.5s ease-out`,
        transitionDelay: `${delay}ms`,
      },
    },
    children
  );
}
