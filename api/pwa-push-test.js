/* eslint-env node */
import { createClient } from '@supabase/supabase-js';
import {
  normalizeText,
  parseWebPushSubscription,
  sendWebPushNotifications,
} from './_lib/pushProviders.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_ORIGIN = process.env.VITE_APP_URL;

function normalizeOrigin(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.origin;
  } catch {
    return null;
  }
}

function resolveAllowedOrigin(req) {
  const configuredOrigin = normalizeOrigin(APP_ORIGIN);
  const requestOrigin = normalizeOrigin(req?.headers?.origin);
  if (!requestOrigin) return configuredOrigin;

  const isLocalDevOrigin = (
    requestOrigin === 'http://localhost:5173'
    || requestOrigin === 'http://127.0.0.1:5173'
  );

  if (requestOrigin === configuredOrigin || isLocalDevOrigin) {
    return requestOrigin;
  }

  return configuredOrigin;
}

function applyCors(req, res) {
  const allowedOrigin = resolveAllowedOrigin(req);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}

async function getUserFromToken(jwt) {
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    fetch,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data, error } = await authClient.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Unauthorized');
  }
  return data.user;
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Supabase environment not configured' });
    return;
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }

    const user = await getUserFromToken(token);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { fetch });

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
      res.status(200).json({
        ok: true,
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

    res.status(200).json({
      ok: true,
      attempted: result.attempted,
      sent: result.sent,
      errors: result.errors,
      invalidatedSubscriptions: result.invalidEndpoints.length,
      skipped: result.skipped || null,
    });
  } catch (error) {
    const status = error?.message === 'Unauthorized' ? 401 : 500;
    res.status(status).json({
      error: error?.message || 'server error',
    });
  }
}
