/* eslint-env node */
import { createHash } from 'node:crypto';
import {
  applyCors,
  getBearerToken,
  getUserFromToken,
  createSupabaseAdmin,
  normalizeText,
  isEnvConfigured,
  sendError,
  sendSuccess,
} from './_lib/apiUtils.js';
import { validateBody, PwaPushSubscribeSchema } from './_lib/validation.js';
import { pushLimiter } from './_lib/rateLimit.js';

function normalizeSubscription(rawSubscription) {
  const endpoint = normalizeText(rawSubscription?.endpoint);
  const p256dh = normalizeText(rawSubscription?.keys?.p256dh);
  const auth = normalizeText(rawSubscription?.keys?.auth);

  if (!endpoint || !p256dh || !auth) return null;

  return {
    endpoint,
    expirationTime: rawSubscription?.expirationTime || null,
    keys: {
      p256dh,
      auth,
    },
  };
}

function buildInstallationId(endpoint) {
  const hash = createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
  return `stocky-web-${hash}`;
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  const rateLimitResult = pushLimiter(req, res);
  if (rateLimitResult.blocked) {
    sendError(res, 429, rateLimitResult.message);
    return;
  }

  if (!isEnvConfigured()) {
    sendError(res, 500, 'Supabase environment not configured');
    return;
  }

  try {
    const validation = validateBody(PwaPushSubscribeSchema, req, res);
    if (!validation.success) return;

    const token = getBearerToken(req);
    if (!token) {
      sendError(res, 401, 'Missing bearer token');
      return;
    }

    const subscription = normalizeSubscription(validation.data.subscription);
    if (!subscription) {
      sendError(res, 400, 'Invalid subscription payload');
      return;
    }

    const user = await getUserFromToken(token);
    const admin = createSupabaseAdmin();

    const installationId = buildInstallationId(subscription.endpoint);
    const nowIso = new Date().toISOString();

    const { error } = await admin
      .from('mobile_push_tokens')
      .upsert({
        user_id: user.id,
        installation_id: installationId,
        push_token: JSON.stringify(subscription),
        platform: 'web',
        app_version: 'pwa',
        is_active: true,
        last_seen_at: nowIso,
        updated_at: nowIso,
      }, {
        onConflict: 'user_id,installation_id',
        ignoreDuplicates: false,
      });

    if (error) throw error;

    sendSuccess(res, { installationId });
  } catch (error) {
    const status = error?.message === 'Unauthorized' ? 401 : 500;
    sendError(res, status, error?.message || 'server error');
  }
}
