const DEFAULT_PRINT_BRIDGE_APK_URL =
  'https://github.com/AndresPlazas10/Stocky/releases/latest/download/stocky-print-bridge-latest.apk';

const DEFAULT_PRINT_BRIDGE_WINDOWS_URL =
  'https://github.com/AndresPlazas10/Stocky/releases/latest/download/Stocky-Print-Bridge-Setup-latest-x64.exe';

export function getPrintBridgeApkDownloadUrl() {
  const value = import.meta.env?.VITE_PRINT_BRIDGE_APK_URL;
  return value && String(value).trim() ? value : DEFAULT_PRINT_BRIDGE_APK_URL;
}

export function getPrintBridgeWindowsDownloadUrl() {
  const value = import.meta.env?.VITE_PRINT_BRIDGE_WINDOWS_URL;
  return value && String(value).trim() ? value : DEFAULT_PRINT_BRIDGE_WINDOWS_URL;
}
