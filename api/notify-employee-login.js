/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_ORIGIN = process.env.VITE_APP_URL;

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_CHUNK_SIZE = 100;

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

function normalizeText(value, fallback = '') {
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

async function sendExpoPushMessages(messages) {
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

function isInvalidDeviceTicket(ticket) {
  const status = normalizeText(ticket?.status).toLowerCase();
  const detailsError = normalizeText(ticket?.details?.error).toLowerCase();
  if (status !== 'error') return false;
  return detailsError === 'devicenotregistered';
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

    const { business_id, employee_name } = req.body || {};
    const businessId = normalizeText(business_id);
    if (!businessId) {
      res.status(400).json({ error: 'Missing param: business_id' });
      return;
    }

    const user = await getUserFromToken(token);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { fetch });

    const employeeResult = await admin
      .from('employees')
      .select('id,full_name,username,user_id,is_active')
      .eq('business_id', businessId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (employeeResult.error) throw employeeResult.error;
    if (!employeeResult.data?.id) {
      res.status(403).json({ error: 'Forbidden: only active employees can notify this event' });
      return;
    }

    const businessResult = await admin
      .from('businesses')
      .select('id,name,created_by')
      .eq('id', businessId)
      .limit(1)
      .maybeSingle();

    if (businessResult.error) throw businessResult.error;
    if (!businessResult.data?.id || !businessResult.data?.created_by) {
      res.status(404).json({ error: 'Business not found' });
      return;
    }

    const adminUserId = normalizeText(businessResult.data.created_by);
    if (!adminUserId) {
      res.status(500).json({ error: 'Business admin user is not configured' });
      return;
    }

    const pushTokensResult = await admin
      .from('mobile_push_tokens')
      .select('id,push_token')
      .eq('user_id', adminUserId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (pushTokensResult.error) throw pushTokensResult.error;

    const uniqueTokens = Array.from(
      new Set(
        (Array.isArray(pushTokensResult.data) ? pushTokensResult.data : [])
          .map((row) => normalizeText(row?.push_token))
          .filter(Boolean),
      ),
    );

    if (uniqueTokens.length === 0) {
      res.status(200).json({
        ok: true,
        notified: 0,
        skipped: 'admin_without_mobile_tokens',
      });
      return;
    }

    const fallbackEmployeeName = normalizeText(employeeResult.data.full_name)
      || normalizeText(employeeResult.data.username)
      || 'Un empleado';
    const employeeName = normalizeText(employee_name) || fallbackEmployeeName;
    const businessName = normalizeText(businessResult.data.name, 'tu negocio');

    const messages = uniqueTokens.map((pushToken) => ({
      to: pushToken,
      sound: 'default',
      priority: 'high',
      channelId: 'stocky-default',
      title: 'Empleado conectado 💚',
      body: `${employeeName} inició sesion en ${businessName}`,
      data: {
        type: 'employee_login',
        business_id: businessId,
        employee_user_id: user.id,
      },
    }));

    const tickets = await sendExpoPushMessages(messages);
    const invalidTokens = [];

    for (let index = 0; index < tickets.length; index += 1) {
      const ticket = tickets[index];
      if (!isInvalidDeviceTicket(ticket)) continue;
      const tokenValue = normalizeText(messages[index]?.to);
      if (tokenValue) invalidTokens.push(tokenValue);
    }

    if (invalidTokens.length > 0) {
      await admin
        .from('mobile_push_tokens')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in('push_token', invalidTokens);
    }

    const errorCount = tickets.filter((ticket) => normalizeText(ticket?.status).toLowerCase() === 'error').length;
    res.status(200).json({
      ok: true,
      notified: uniqueTokens.length,
      ticketCount: tickets.length,
      ticketErrors: errorCount,
      invalidatedTokens: invalidTokens.length,
    });
  } catch (error) {
    const status = error?.message === 'Unauthorized' ? 401 : 500;
    res.status(status).json({
      error: error?.message || 'server error',
    });
  }
}
