import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { EXPO_CONFIG } from '../config/env';
import { getSupabaseClient } from '../lib/supabase';

const INSTALLATION_ID_KEY = 'stocky.mobile.installation_id';
const DEFAULT_NOTIFICATION_CHANNEL_ID = 'stocky-default';

let notificationsConfigured = false;
let notificationsModuleCache: typeof import('expo-notifications') | null = null;

function getNotificationsModule() {
  if (!shouldEnableMobileNotificationsRuntime()) return null;
  if (notificationsModuleCache) return notificationsModuleCache;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    notificationsModuleCache = require('expo-notifications') as typeof import('expo-notifications');
    return notificationsModuleCache;
  } catch (error) {
    console.log('[notifications] expo-notifications unavailable in current runtime', error);
    return null;
  }
}

type PushRegistrationResult =
  | { ok: true; token: string; installationId: string }
  | { ok: false; reason: 'unsupported' | 'simulator' | 'expo_go_unsupported' | 'permission_denied' | 'missing_project_id' | 'error'; message: string };

type NotifyAdminEmployeeLoginResult =
  | { ok: true; status: number; data: any }
  | { ok: false; status: number | null; message: string };
type NotifyAdminSaleRegisteredResult =
  | { ok: true; status: number; data: any }
  | { ok: false; status: number | null; message: string };
type NotifyAdminLowStockResult =
  | { ok: true; status: number; data: any }
  | { ok: false; status: number | null; message: string };

function createInstallationId() {
  return `stocky-mobile-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getInstallationId() {
  const stored = String((await AsyncStorage.getItem(INSTALLATION_ID_KEY)) || '').trim();
  if (stored) return stored;
  const next = createInstallationId();
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, next);
  return next;
}

function resolveProjectId() {
  const fromEnv = String(EXPO_CONFIG.easProjectId || '').trim();
  if (fromEnv) return fromEnv;

  const fromEasConfig = String((Constants as any)?.easConfig?.projectId || '').trim();
  if (fromEasConfig) return fromEasConfig;

  const fromExpoConfigExtra = String((Constants as any)?.expoConfig?.extra?.eas?.projectId || '').trim();
  if (fromExpoConfigExtra) return fromExpoConfigExtra;

  return '';
}

function isExpoGoRuntime() {
  const executionEnvironment = String((Constants as any)?.executionEnvironment || '').toLowerCase();
  return executionEnvironment === 'storeclient';
}

export function shouldEnableMobileNotificationsRuntime() {
  if (Platform.OS === 'web') return false;
  if (isExpoGoRuntime()) return false;
  return true;
}

export function getMobileNotificationsModule() {
  return getNotificationsModule();
}

export function configureMobileNotifications() {
  if (!shouldEnableMobileNotificationsRuntime()) return;
  if (notificationsConfigured) return;

  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  notificationsConfigured = true;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.log('[notifications] setNotificationHandler skipped', error);
    return;
  }

  if (Platform.OS === 'android') {
    try {
      void Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
        name: 'General',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#1D4ED8',
      });
    } catch (error) {
      console.log('[notifications] setNotificationChannelAsync skipped', error);
    }
  }
}

export async function registerPushTokenForSession(session: Session): Promise<PushRegistrationResult> {
  try {
    if (Platform.OS === 'web') {
      return {
        ok: false,
        reason: 'unsupported',
        message: 'Push notifications are not supported on web runtime.',
      };
    }

    if (isExpoGoRuntime()) {
      return {
        ok: false,
        reason: 'expo_go_unsupported',
        message: 'Expo Go does not support remote push notifications on SDK 53+.',
      };
    }

    const Notifications = getNotificationsModule();
    if (!Notifications) {
      return {
        ok: false,
        reason: 'unsupported',
        message: 'expo-notifications module is unavailable in this runtime.',
      };
    }

    if (!Device.isDevice) {
      return {
        ok: false,
        reason: 'simulator',
        message: 'Push notifications require a physical device.',
      };
    }

    const existingPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermissions.status;
    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      return {
        ok: false,
        reason: 'permission_denied',
        message: 'Notification permission was not granted.',
      };
    }

    const projectId = resolveProjectId();
    if (!projectId) {
      return {
        ok: false,
        reason: 'missing_project_id',
        message: 'Missing EAS project id for Expo push token registration.',
      };
    }

    const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = String(pushToken?.data || '').trim();
    if (!token) {
      return {
        ok: false,
        reason: 'error',
        message: 'Expo push token was empty.',
      };
    }

    const installationId = await getInstallationId();
    const client = getSupabaseClient();
    const nowIso = new Date().toISOString();

    const { error } = await client
      .from('mobile_push_tokens')
      .upsert({
        user_id: session.user.id,
        installation_id: installationId,
        push_token: token,
        platform: Platform.OS,
        app_version: EXPO_CONFIG.clientVersion,
        is_active: true,
        last_seen_at: nowIso,
        updated_at: nowIso,
      }, {
        onConflict: 'user_id,installation_id',
        ignoreDuplicates: false,
      });

    if (error) throw error;

    return { ok: true, token, installationId };
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : String((err as any)?.message || err || 'Failed to register push token.');
    if (String(message).toLowerCase().includes('expo-notifications')) {
      return {
        ok: false,
        reason: 'expo_go_unsupported',
        message,
      };
    }

    return {
      ok: false,
      reason: 'error',
      message,
    };
  }
}

export async function deactivatePushTokenForUser(userId: string): Promise<void> {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return;

  const installationId = await getInstallationId();
  const client = getSupabaseClient();
  const nowIso = new Date().toISOString();

  await client
    .from('mobile_push_tokens')
    .update({
      is_active: false,
      updated_at: nowIso,
      last_seen_at: nowIso,
    })
    .eq('user_id', normalizedUserId)
    .eq('installation_id', installationId);
}

export async function deactivateOtherPushTokensForUser(
  userId: string,
  installationId: string,
): Promise<void> {
  const normalizedUserId = String(userId || '').trim();
  const normalizedInstallationId = String(installationId || '').trim();
  if (!normalizedUserId || !normalizedInstallationId) return;

  const client = getSupabaseClient();
  const nowIso = new Date().toISOString();

  await client
    .from('mobile_push_tokens')
    .update({
      is_active: false,
      updated_at: nowIso,
    })
    .eq('user_id', normalizedUserId)
    .eq('platform', Platform.OS)
    .neq('installation_id', normalizedInstallationId)
    .eq('is_active', true);
}

async function notifyAdminEmployeeLoginViaRoute({
  route,
  accessToken,
  businessId,
  employeeName,
}: {
  route: '/api/v2/notify-employee-login' | '/api/notify-employee-login';
  accessToken: string;
  businessId: string;
  employeeName?: string | null;
}): Promise<NotifyAdminEmployeeLoginResult> {
  try {
    const response = await fetch(`${EXPO_CONFIG.apiBaseUrl}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Stocky-Client': 'mobile',
        'X-Stocky-Client-Version': EXPO_CONFIG.clientVersion,
      },
      body: JSON.stringify({
        business_id: businessId,
        employee_name: employeeName || null,
      }),
    });

    const raw = await response.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { error: raw || 'Unexpected response' };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: String(payload?.error || payload?.message || `Request failed (${response.status})`),
      };
    }

    return { ok: true, status: response.status, data: payload };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : String((error as any)?.message || error || 'Network error');
    const targetUrl = `${EXPO_CONFIG.apiBaseUrl}${route}`;
    return {
      ok: false,
      status: null,
      message: `${errorMessage} (url: ${targetUrl})`,
    };
  }
}

export async function notifyAdminEmployeeLogin({
  accessToken,
  businessId,
  employeeName,
}: {
  accessToken: string;
  businessId: string;
  employeeName?: string | null;
}): Promise<NotifyAdminEmployeeLoginResult> {
  const normalizedToken = String(accessToken || '').trim();
  const normalizedBusinessId = String(businessId || '').trim();
  if (!normalizedToken || !normalizedBusinessId) {
    return {
      ok: false,
      status: null,
      message: 'Missing access token or business id',
    };
  }

  const first = await notifyAdminEmployeeLoginViaRoute({
    route: '/api/v2/notify-employee-login',
    accessToken: normalizedToken,
    businessId: normalizedBusinessId,
    employeeName,
  });

  if (first.ok) return first;
  if (first.status !== 404) return first;

  return notifyAdminEmployeeLoginViaRoute({
    route: '/api/notify-employee-login',
    accessToken: normalizedToken,
    businessId: normalizedBusinessId,
    employeeName,
  });
}

async function notifyAdminSaleRegisteredViaRoute({
  route,
  accessToken,
  businessId,
  saleTotal,
}: {
  route: '/api/v2/notify-sale-registered' | '/api/notify-sale-registered';
  accessToken: string;
  businessId: string;
  saleTotal: number;
}): Promise<NotifyAdminSaleRegisteredResult> {
  try {
    const response = await fetch(`${EXPO_CONFIG.apiBaseUrl}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Stocky-Client': 'mobile',
        'X-Stocky-Client-Version': EXPO_CONFIG.clientVersion,
      },
      body: JSON.stringify({
        business_id: businessId,
        sale_total: saleTotal,
      }),
    });

    const raw = await response.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { error: raw || 'Unexpected response' };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: String(payload?.error || payload?.message || `Request failed (${response.status})`),
      };
    }

    return { ok: true, status: response.status, data: payload };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : String((error as any)?.message || error || 'Network error');
    const targetUrl = `${EXPO_CONFIG.apiBaseUrl}${route}`;
    return {
      ok: false,
      status: null,
      message: `${errorMessage} (url: ${targetUrl})`,
    };
  }
}

export async function notifyAdminSaleRegistered({
  accessToken,
  businessId,
  saleTotal,
}: {
  accessToken: string;
  businessId: string;
  saleTotal: number;
}): Promise<NotifyAdminSaleRegisteredResult> {
  const normalizedToken = String(accessToken || '').trim();
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedSaleTotal = Number(saleTotal);
  if (!normalizedToken || !normalizedBusinessId || !Number.isFinite(normalizedSaleTotal)) {
    return {
      ok: false,
      status: null,
      message: 'Missing access token, business id, or sale total',
    };
  }

  const first = await notifyAdminSaleRegisteredViaRoute({
    route: '/api/v2/notify-sale-registered',
    accessToken: normalizedToken,
    businessId: normalizedBusinessId,
    saleTotal: normalizedSaleTotal,
  });

  if (first.ok) return first;
  if (first.status !== 404) return first;

  return notifyAdminSaleRegisteredViaRoute({
    route: '/api/notify-sale-registered',
    accessToken: normalizedToken,
    businessId: normalizedBusinessId,
    saleTotal: normalizedSaleTotal,
  });
}

async function notifyAdminLowStockViaRoute({
  route,
  accessToken,
  businessId,
  productIds,
}: {
  route: '/api/v2/notify-low-stock' | '/api/notify-low-stock';
  accessToken: string;
  businessId: string;
  productIds: string[];
}): Promise<NotifyAdminLowStockResult> {
  try {
    const response = await fetch(`${EXPO_CONFIG.apiBaseUrl}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Stocky-Client': 'mobile',
        'X-Stocky-Client-Version': EXPO_CONFIG.clientVersion,
      },
      body: JSON.stringify({
        business_id: businessId,
        product_ids: productIds,
      }),
    });

    const raw = await response.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { error: raw || 'Unexpected response' };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: String(payload?.error || payload?.message || `Request failed (${response.status})`),
      };
    }

    return { ok: true, status: response.status, data: payload };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : String((error as any)?.message || error || 'Network error');
    const targetUrl = `${EXPO_CONFIG.apiBaseUrl}${route}`;
    return {
      ok: false,
      status: null,
      message: `${errorMessage} (url: ${targetUrl})`,
    };
  }
}

export async function notifyAdminLowStock({
  accessToken,
  businessId,
  productIds,
}: {
  accessToken: string;
  businessId: string;
  productIds: string[];
}): Promise<NotifyAdminLowStockResult> {
  const normalizedToken = String(accessToken || '').trim();
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedProductIds = Array.isArray(productIds)
    ? productIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  if (!normalizedToken || !normalizedBusinessId || normalizedProductIds.length === 0) {
    return {
      ok: false,
      status: null,
      message: 'Missing access token, business id, or product ids',
    };
  }

  const first = await notifyAdminLowStockViaRoute({
    route: '/api/v2/notify-low-stock',
    accessToken: normalizedToken,
    businessId: normalizedBusinessId,
    productIds: normalizedProductIds,
  });

  if (first.ok) return first;
  if (first.status !== 404) return first;

  return notifyAdminLowStockViaRoute({
    route: '/api/notify-low-stock',
    accessToken: normalizedToken,
    businessId: normalizedBusinessId,
    productIds: normalizedProductIds,
  });
}
