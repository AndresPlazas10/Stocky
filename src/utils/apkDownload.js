const FALLBACK_APK_URL =
  'https://expo.dev/artifacts/eas/gmXrkZSbggQg3Tvgmu8awp.apk';

export function getApkDownloadUrl() {
  const envUrl = String(import.meta.env?.VITE_APK_URL || '').trim();
  if (envUrl) return envUrl;
  return FALLBACK_APK_URL;
}

