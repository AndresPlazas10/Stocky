import { EXPO_CONFIG } from '../config/env';
import { getSupabaseClient } from '../lib/supabase';

export type AppUpdateNotice = {
  latestVersion: string;
  minSupportedVersion: string | null;
  ctaUrl: string;
  message: string;
};

type AppUpdateRow = {
  latest_version: string | null;
  min_supported_version: string | null;
  cta_url: string | null;
  message: string | null;
};

function toNumberParts(value: string) {
  const normalized = String(value || '')
    .trim()
    .split(/\D+/)
    .filter(Boolean)
    .map((segment) => Number(segment));
  return normalized.length ? normalized : [0];
}

function compareVersions(current: string, latest: string) {
  const currentParts = toNumberParts(current);
  const latestParts = toNumberParts(latest);
  const max = Math.max(currentParts.length, latestParts.length);

  for (let i = 0; i < max; i += 1) {
    const a = currentParts[i] ?? 0;
    const b = latestParts[i] ?? 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }

  return 0;
}

function normalizeMessage(message?: string | null) {
  const trimmed = String(message || '').trim();
  if (trimmed) return trimmed;
  return 'Hay una actualización de seguridad disponible. Actualiza Stocky para mantener tu cuenta protegida.';
}

export async function fetchAppUpdateNotice(
  platform: 'android' | 'ios',
  currentVersion: string,
): Promise<AppUpdateNotice | null> {
  let client;
  try {
    client = getSupabaseClient();
  } catch {
    return null;
  }

  const { data, error } = await client
    .from('app_updates')
    .select('latest_version,min_supported_version,cta_url,message')
    .eq('platform', platform)
    .maybeSingle<AppUpdateRow>();

  if (error || !data?.latest_version) return null;

  const shouldShow = compareVersions(currentVersion, data.latest_version) < 0;
  if (!shouldShow) return null;

  return {
    latestVersion: data.latest_version,
    minSupportedVersion: data.min_supported_version || null,
    ctaUrl: data.cta_url || EXPO_CONFIG.androidDownloadUrl,
    message: normalizeMessage(data.message),
  };
}
