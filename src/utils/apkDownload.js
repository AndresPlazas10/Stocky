const FALLBACK_APK_URL =
  'https://github.com/AndresPlazas10/Stocky/releases/download/v1.0.11/stocky-mobile-1.0.11.apk';

export function getApkDownloadUrl() {
  const envUrl = String(import.meta.env?.VITE_APK_URL || '').trim();
  if (envUrl) return envUrl;
  return FALLBACK_APK_URL;
}
