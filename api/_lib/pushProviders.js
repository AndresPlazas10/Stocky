/* eslint-env node */
import webpush from 'web-push';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_CHUNK_SIZE = 100;

const WEB_PUSH_PUBLIC_KEY = String(process.env.WEB_PUSH_PUBLIC_KEY || process.env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();
const WEB_PUSH_PRIVATE_KEY = String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim();
const WEB_PUSH_SUBJECT = String(process.env.WEB_PUSH_SUBJECT || 'mailto:soporte@stockypos.app').trim();

let webPushConfigured = false;

export function normalizeText(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function chunkArray(values, chunkSize) {
  const size = Number(chunkSize) > 0 ? Number(chunkSize) : 100;
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function isExpoDeviceNotRegisteredTicket(ticket) {
  const status = normalizeText(ticket?.status).toLowerCase();
  const detailsError = normalizeText(ticket?.details?.error).toLowerCase();
  if (status !== 'error') return false;
  return detailsError === 'devicenotregistered';
}

export async function sendExpoPushMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const chunks = chunkArray(messages, EXPO_PUSH_CHUNK_SIZE);
  const tickets = [];

  for (const chunk of chunks) {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(chunk),
    });

    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { raw };
    }

    if (!response.ok) {
      throw new Error(`Expo push request failed (${response.status})`);
    }

    const batchTickets = Array.isArray(payload?.data) ? payload.data : [];
    for (const ticket of batchTickets) {
      tickets.push(ticket);
    }
  }

  return tickets;
}

function ensureWebPushConfigured() {
  if (webPushConfigured) return true;
  if (!WEB_PUSH_PUBLIC_KEY || !WEB_PUSH_PRIVATE_KEY) return false;

  webpush.setVapidDetails(WEB_PUSH_SUBJECT, WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY);
  webPushConfigured = true;
  return true;
}

export function parseWebPushSubscription(rawPushToken) {
  const raw = normalizeText(rawPushToken);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const endpoint = normalizeText(parsed?.endpoint);
    const p256dh = normalizeText(parsed?.keys?.p256dh);
    const auth = normalizeText(parsed?.keys?.auth);
    if (!endpoint || !p256dh || !auth) return null;

    return {
      endpoint,
      expirationTime: parsed?.expirationTime || null,
      keys: {
        p256dh,
        auth,
      },
    };
  } catch {
    return null;
  }
}

export async function sendWebPushNotifications({ subscriptions, payload }) {
  const normalizedSubs = Array.isArray(subscriptions) ? subscriptions.filter(Boolean) : [];
  if (normalizedSubs.length === 0) {
    return {
      attempted: 0,
      sent: 0,
      errors: 0,
      invalidEndpoints: [],
      skipped: 'no_web_subscriptions',
    };
  }

  if (!ensureWebPushConfigured()) {
    return {
      attempted: normalizedSubs.length,
      sent: 0,
      errors: normalizedSubs.length,
      invalidEndpoints: [],
      skipped: 'web_push_not_configured',
    };
  }

  let sent = 0;
  let errors = 0;
  const invalidEndpoints = [];
  const serializedPayload = JSON.stringify(payload || {});

  for (const subscription of normalizedSubs) {
    try {
      await webpush.sendNotification(subscription, serializedPayload, {
        TTL: 60,
      });
      sent += 1;
    } catch (error) {
      errors += 1;
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        const endpoint = normalizeText(subscription?.endpoint);
        if (endpoint) invalidEndpoints.push(endpoint);
      }
    }
  }

  return {
    attempted: normalizedSubs.length,
    sent,
    errors,
    invalidEndpoints,
  };
}
