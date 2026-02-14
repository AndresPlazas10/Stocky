/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { fetch });

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

async function userCanAccessBusiness(userId, businessId) {
  const [{ data: owner }, { data: employee }] = await Promise.all([
    admin
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('created_by', userId)
      .limit(1),
    admin
      .from('employees')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1),
  ]);

  return (owner && owner.length > 0) || (employee && employee.length > 0);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY || !SUPABASE_URL) {
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

    const { table_id, action } = req.body || {};
    if (!table_id || !action) {
      res.status(400).json({ error: 'Missing params: table_id/action' });
      return;
    }

    const normalizedAction = action === 'open' ? 'open' : action === 'close' ? 'close' : null;
    if (!normalizedAction) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    const { data: tableRow, error: tableError } = await admin
      .from('tables')
      .select('id,business_id,status,opened_at,closed_at,updated_at,version')
      .eq('id', table_id)
      .maybeSingle();

    if (tableError) throw tableError;
    if (!tableRow) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    const canAccess = await userCanAccessBusiness(user.id, tableRow.business_id);
    if (!canAccess) {
      res.status(403).json({ error: 'Forbidden for this business' });
      return;
    }

    const nowIso = new Date().toISOString();
    const nextStatus = normalizedAction === 'open' ? 'occupied' : 'available';

    if (tableRow.status === nextStatus) {
      res.status(200).json({ ok: true, data: tableRow });
      return;
    }

    const updatePayload = normalizedAction === 'open'
      ? {
          status: 'occupied',
          opened_by: user.id,
          opened_at: nowIso,
          updated_at: nowIso,
          version: (tableRow.version || 0) + 1,
        }
      : {
          status: 'available',
          closed_by: user.id,
          closed_at: nowIso,
          updated_at: nowIso,
          version: (tableRow.version || 0) + 1,
        };

    const { data: updated, error: updateError } = await admin
      .from('tables')
      .update(updatePayload)
      .eq('id', table_id)
      .eq('business_id', tableRow.business_id)
      .select('id,business_id,status,opened_at,closed_at,updated_at,version')
      .single();

    if (updateError) throw updateError;

    res.status(200).json({ ok: true, data: updated });
  } catch (err) {
    const status = err?.message === 'Unauthorized' ? 401 : 500;
    res.status(status).json({ error: err?.message || 'server error' });
  }
}
