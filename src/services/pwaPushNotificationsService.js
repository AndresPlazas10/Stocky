import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';

function isLocalhost() {
  if (typeof window === 'undefined') return false;
  const host = String(window.location?.hostname || '').trim();
  return host === 'localhost' || host === '127.0.0.1';
}

function resolveApiBaseUrl() {
  const raw = String(import.meta.env?.VITE_API_BASE_URL || '').trim();
  const normalized = raw.replace(/\/$/, '');
  if (isLocalhost()) return '';
  return normalized;
}

let cachedPublicKey = null;

async function fetchWebPushPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;

  // Primero intentar desde variable de entorno
  const envKey = String(import.meta.env?.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();
  if (envKey) {
    cachedPublicKey = envKey;
    return envKey;
  }

  // Si no está en env, obtener del endpoint
  try {
    const baseUrl = resolveApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/pwa-push-public-key`);
    if (response.ok) {
      const data = await response.json();
      if (data.publicKey) {
        cachedPublicKey = data.publicKey;
        return data.publicKey;
      }
    }
  } catch {
    // Silenciar error
  }

  return '';
}

function resolveWebPushPublicKey() {
  return String(import.meta.env?.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function normalizePermission(value) {
  const permission = String(value || '').trim().toLowerCase();
  if (permission === 'granted' || permission === 'denied' || permission === 'default') return permission;
  return 'default';
}

export async function getWebPushSupportStatus() {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'server_runtime', permission: 'default' };
  }

  const isSecure = Boolean(window.isSecureContext) || isLocalhost();
  if (!isSecure) {
    return { supported: false, reason: 'requires_https', permission: normalizePermission(window.Notification?.permission) };
  }

  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'missing_service_worker', permission: normalizePermission(window.Notification?.permission) };
  }

  if (!('PushManager' in window)) {
    return { supported: false, reason: 'missing_push_manager', permission: normalizePermission(window.Notification?.permission) };
  }

  if (!('Notification' in window)) {
    return { supported: false, reason: 'missing_notification_api', permission: 'default' };
  }

  const publicKey = await fetchWebPushPublicKey();
  if (!publicKey) {
    return { supported: false, reason: 'missing_vapid_public_key', permission: normalizePermission(window.Notification.permission) };
  }

  return {
    supported: true,
    reason: null,
    permission: normalizePermission(window.Notification.permission),
  };
}

async function resolveAccessToken() {
  const sessionResult = await supabaseAdapter.getCurrentSession();
  return String(sessionResult?.data?.session?.access_token || '').trim() || null;
}

async function postWithAuth(route, body, accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) {
    return { ok: false, status: null, message: 'Missing access token' };
  }

  const url = `${resolveApiBaseUrl()}${route}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Stocky-Client': 'web',
      },
      body: JSON.stringify(body || {}),
    });

    const raw = await response.text();
    let payload = null;
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
        data: payload,
      };
    }

    return { ok: true, status: response.status, data: payload };
  } catch (error) {
    return {
      ok: false,
      status: null,
      message: error instanceof Error ? error.message : String(error || 'Network error'),
      data: null,
    };
  }
}

export async function registerPwaPushSubscription({ askPermission = false } = {}) {
  const support = await getWebPushSupportStatus();
  if (!support.supported) {
    return {
      ok: false,
      reason: support.reason,
      permission: support.permission,
      message: 'Web push is not supported in this context.',
    };
  }

  let permission = support.permission;
  if (permission !== 'granted') {
    if (!askPermission) {
      return {
        ok: false,
        reason: 'permission_not_granted',
        permission,
        message: 'Notification permission is not granted yet.',
      };
    }

    const nextPermission = await window.Notification.requestPermission();
    permission = normalizePermission(nextPermission);

    if (permission !== 'granted') {
      return {
        ok: false,
        reason: permission === 'denied' ? 'permission_denied' : 'permission_default',
        permission,
        message: 'Notification permission was not granted.',
      };
    }
  }

  const registration = await navigator.serviceWorker.ready;
  const publicKey = await fetchWebPushPublicKey();
  if (!publicKey) {
    return {
      ok: false,
      reason: 'missing_vapid_public_key',
      permission,
      message: 'VAPID public key not available.',
    };
  }
  const appServerKey = urlBase64ToUint8Array(publicKey);

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  }

  const accessToken = await resolveAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      reason: 'missing_access_token',
      permission,
      message: 'No active session available for registering subscription.',
    };
  }

  const result = await postWithAuth('/api/pwa-push-subscribe', {
    subscription: subscription.toJSON(),
  }, accessToken);

  if (!result.ok) {
    return {
      ok: false,
      reason: 'backend_register_failed',
      permission,
      message: result.message,
      status: result.status,
    };
  }

  return {
    ok: true,
    permission,
    installationId: result?.data?.installationId || null,
  };
}

export async function sendPwaPushTestNotification() {
  const accessToken = await resolveAccessToken();
  if (!accessToken) {
    return { ok: false, status: null, message: 'Missing access token' };
  }

  return postWithAuth('/api/pwa-push-test', {}, accessToken);
}
