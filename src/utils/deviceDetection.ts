/**
 * Utilidades para detectar el dispositivo y entorno de ejecución
 */

interface DeviceInfo {
  isIOs: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  isSafari: boolean;
  isChrome: boolean;
  userAgent: string;
  platform: string;
}

/**
 * Detecta si el usuario está en iOS (iPhone, iPad, iPod)
 */
export function isIOs(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

/**
 * Detecta si el usuario está en Android
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /android/.test(userAgent);
}

/**
 * Detecta si la app está ejecutándose en modo standalone (PWA instalada)
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Detecta si el navegador es Safari
 */
export function isSafari(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isSafariBrowser = /safari/.test(userAgent) && !/chrome/.test(userAgent);

  return isSafariBrowser;
}

/**
 * Detecta si el navegador es Chrome
 */
export function isChrome(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /chrome/.test(userAgent) && !/edge|edg/.test(userAgent);
}

/**
 * Obtiene información completa del dispositivo/navegador
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    isIOs: isIOs(),
    isAndroid: isAndroid(),
    isStandalone: isStandalone(),
    isSafari: isSafari(),
    isChrome: isChrome(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
    platform: typeof window !== 'undefined' ? window.navigator.platform : '',
  };
}

/**
 * Detecta si el dispositivo soporta instalación PWA
 */
export function supportsPWA(): boolean {
  if (typeof window === 'undefined') return false;

  // iOS 16.4+ soporta PWA con notificaciones
  if (isIOs()) {
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      // iOS 16.4 o superior
      return major > 16 || (major === 16 && minor >= 4);
    }
    return false;
  }

  // Android y desktop generalmente soportan
  return 'serviceWorker' in navigator;
}
