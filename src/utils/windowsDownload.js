const FALLBACK_WINDOWS_URL =
  'https://github.com/AndresPlazas10/Stocky/releases/latest/download/Stocky-Setup-1.0.0-x64.exe';

export function getWindowsDownloadUrl() {
  const envUrl = String(import.meta.env?.VITE_WINDOWS_URL || '').trim();
  if (envUrl) return envUrl;
  return FALLBACK_WINDOWS_URL;
}
