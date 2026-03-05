import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT_PX = 1024;

export function useLowMotionMode() {
  const getLowMotion = () => {
    if (typeof window === 'undefined') return false;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    const isMobileLike = window.innerWidth < MOBILE_BREAKPOINT_PX;
    return reduceMotion || isMobileLike;
  };

  const [lowMotionMode, setLowMotionMode] = useState(getLowMotion);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setLowMotionMode(getLowMotion());

    update();
    window.addEventListener('resize', update);
    mediaQuery.addEventListener?.('change', update);

    return () => {
      window.removeEventListener('resize', update);
      mediaQuery.removeEventListener?.('change', update);
    };
  }, []);

  return lowMotionMode;
}

