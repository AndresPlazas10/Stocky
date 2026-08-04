import { useState, useEffect } from 'react';

export interface ViewportState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'landscape' | 'portrait';
}

export function useViewport(): ViewportState {
  const [viewport, setViewport] = useState<ViewportState>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 640 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= 640 && window.innerWidth < 1024 : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
    orientation: typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
  }));

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setViewport({
        width,
        height,
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024,
        orientation: width > height ? 'landscape' : 'portrait',
      });
    };

    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return viewport;
}

export function useIsIOS(): boolean {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);
  }, []);

  return isIOS;
}

export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
  }, []);

  return isStandalone;
}
