/* eslint-env node */
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
import {
  parseWebPushSubscription,
  sendWebPushNotifications,
} from './_lib/pushProviders.js';
import { pushLimiter } from './_lib/rateLimit.js';

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
    const token = getBearerToken(req);
    if (!token) {
      sendError(res, 401, 'Missing bearer token');
      return;
    }

    const user = await getUserFromToken(token);
    const admin = createSupabaseAdmin();

    const rowsResult = await admin
      .from('mobile_push_tokens')
      .select('id,push_token,platform')
      .eq('user_id', user.id)
      .eq('platform', 'web')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (rowsResult.error) throw rowsResult.error;

    const rows = Array.isArray(rowsResult.data) ? rowsResult.data : [];
    const subscriptionsById = rows
      .map((row) => ({
        id: row.id,
        subscription: parseWebPushSubscription(row.push_token),
      }))
      .filter((item) => item.subscription);

    if (subscriptionsById.length === 0) {
      sendSuccess(res, {
        sent: 0,
        skipped: 'user_without_web_subscriptions',
      });
      return;
    }

    const payload = {
      title: 'Notificacion de prueba Stocky',
      body: 'Tu PWA en iOS quedo registrada correctamente.',
      data: {
        type: 'pwa_test',
        url: '/dashboard',
        sent_at: new Date().toISOString(),
      },
    };

    const result = await sendWebPushNotifications({
      subscriptions: subscriptionsById.map((item) => item.subscription),
      payload,
    });

    if (result.invalidEndpoints.length > 0) {
      const idsToDeactivate = subscriptionsById
        .filter((item) => {
          const endpoint = normalizeText(item.subscription?.endpoint);
          return endpoint && result.invalidEndpoints.includes(endpoint);
        })
        .map((item) => item.id)
        .filter(Boolean);

      if (idsToDeactivate.length > 0) {
        await admin
          .from('mobile_push_tokens')
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .in('id', idsToDeactivate);
      }
    }

    sendSuccess(res, {
      attempted: result.attempted,
      sent: result.sent,
      errors: result.errors,
      invalidatedSubscriptions: result.invalidEndpoints.length,
      skipped: result.skipped || null,
    });
  } catch (error) {
    const status = error?.message === 'Unauthorized' ? 401 : 500;
    sendError(res, status, error?.message || 'server error');
  }
}
