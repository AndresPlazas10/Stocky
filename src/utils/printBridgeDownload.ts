const FALLBACK_PRINT_BRIDGE_WINDOWS_URL =
  'https://github.com/AndresPlazas10/Stocky/releases/download/print-bridge-v0.2.0/Stocky-Print-Bridge-Setup-0.2.0-x64.exe';

export function getPrintBridgeWindowsUrl(): string {
  const envUrl = String((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PRINT_BRIDGE_WINDOWS_URL || '').trim();
  if (envUrl) return envUrl;
  return FALLBACK_PRINT_BRIDGE_WINDOWS_URL;
}
