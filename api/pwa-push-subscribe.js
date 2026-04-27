/* eslint-env node */
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { normalizeText } from './_lib/pushProviders.js';

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

    const subscription = normalizeSubscription(req.body?.subscription);
    if (!subscription) {
      res.status(400).json({ error: 'Invalid subscription payload' });
      return;
    }

    const user = await getUserFromToken(token);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { fetch });

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

    res.status(200).json({
      ok: true,
      installationId,
    });
  } catch (error) {
    const status = error?.message === 'Unauthorized' ? 401 : 500;
    res.status(status).json({
      error: error?.message || 'server error',
    });
  }
}
