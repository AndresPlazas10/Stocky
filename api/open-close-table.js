/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

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

function mapRpcErrorToHttpStatus(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (message.includes('unauthorized')) return 401;
  if (message.includes('no autorizado') || message.includes('forbidden')) return 403;
  if (message.includes('no encontrada') || message.includes('not found')) return 404;
  if (
    message.includes('invalid')
    || message.includes('obligatorio')
    || message.includes('requerido')
    || message.includes('missing')
  ) {
    return 400;
  }
  return 500;
}

function isMissingOpenCloseTableRpcError(errorLike) {
  const code = String(errorLike?.code || '').toLowerCase();
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  const missingFunction = (
    message.includes('open_close_table_transaction')
    && (
      message.includes('does not exist')
      || message.includes('could not find the function')
      || message.includes('schema cache')
      || message.includes('not found')
    )
  );

  return code === 'pgrst202' || code === '42883' || missingFunction;
}

function isMissingOpenedAtOnTablesError(errorLike) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('column')
    && message.includes('"opened_at"')
    && message.includes('relation')
    && message.includes('"tables"')
    && message.includes('does not exist')
  );
}

async function userCanAccessBusiness(admin, userId, businessId) {
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

async function runLegacyOpenCloseTable({
  admin,
  tableId,
  action,
  userId
}) {
  const { data: tableRow, error: tableError } = await admin
    .from('tables')
    .select('id,business_id,current_order_id,status')
    .eq('id', tableId)
    .maybeSingle();

  if (tableError) throw tableError;
  if (!tableRow) {
    throw new Error('Table not found');
  }

  const canAccess = await userCanAccessBusiness(admin, userId, tableRow.business_id);
  if (!canAccess) {
    throw new Error('Forbidden for this business');
  }

  const nowIso = new Date().toISOString();
  let nextOrderId = tableRow.current_order_id;

  if (action === 'open') {
    if (!nextOrderId) {
      const createWithOpenedAt = await admin
        .from('orders')
        .insert([{
          business_id: tableRow.business_id,
          table_id: tableId,
          user_id: userId,
          status: 'open',
          total: 0,
          opened_at: nowIso
        }])
        .select('id')
        .single();

      let createdOrder = createWithOpenedAt.data;
      let createOrderError = createWithOpenedAt.error;
      if (createOrderError && String(createOrderError?.message || '').toLowerCase().includes('"opened_at"')) {
        const createWithoutOpenedAt = await admin
          .from('orders')
          .insert([{
            business_id: tableRow.business_id,
            table_id: tableId,
            user_id: userId,
            status: 'open',
            total: 0
          }])
          .select('id')
          .single();
        createdOrder = createWithoutOpenedAt.data;
        createOrderError = createWithoutOpenedAt.error;
      }

      if (createOrderError) throw createOrderError;
      nextOrderId = createdOrder?.id || null;
    } else {
      const reopenWithOpenedAt = await admin
        .from('orders')
        .update({
          status: 'open',
          table_id: tableId,
          business_id: tableRow.business_id,
          opened_at: nowIso,
          closed_at: null
        })
        .eq('id', nextOrderId)
        .eq('business_id', tableRow.business_id);

      let reopenOrderError = reopenWithOpenedAt.error;
      if (reopenOrderError && String(reopenOrderError?.message || '').toLowerCase().includes('"opened_at"')) {
        const reopenWithoutOpenedAt = await admin
          .from('orders')
          .update({
            status: 'open',
            table_id: tableId,
            business_id: tableRow.business_id,
            closed_at: null
          })
          .eq('id', nextOrderId)
          .eq('business_id', tableRow.business_id);
        reopenOrderError = reopenWithoutOpenedAt.error;
      }

      if (reopenOrderError) {
        const createWithOpenedAt = await admin
          .from('orders')
          .insert([{
            business_id: tableRow.business_id,
            table_id: tableId,
            user_id: userId,
            status: 'open',
            total: 0,
            opened_at: nowIso
          }])
          .select('id')
          .single();

        let createdOrder = createWithOpenedAt.data;
        let createOrderError = createWithOpenedAt.error;
        if (createOrderError && String(createOrderError?.message || '').toLowerCase().includes('"opened_at"')) {
          const createWithoutOpenedAt = await admin
            .from('orders')
            .insert([{
              business_id: tableRow.business_id,
              table_id: tableId,
              user_id: userId,
              status: 'open',
              total: 0
            }])
            .select('id')
            .single();
          createdOrder = createWithoutOpenedAt.data;
          createOrderError = createWithoutOpenedAt.error;
        }

        if (createOrderError) throw createOrderError;
        nextOrderId = createdOrder?.id || null;
      }
    }

    await admin
      .from('orders')
      .update({
        status: 'cancelled',
        closed_at: nowIso,
        table_id: null
      })
      .eq('business_id', tableRow.business_id)
      .eq('table_id', tableId)
      .eq('status', 'open')
      .neq('id', nextOrderId);
  } else {
    const { error: closeOrderError } = await admin
      .from('orders')
      .update({
        status: 'closed',
        closed_at: nowIso
      })
      .eq('business_id', tableRow.business_id)
      .eq('table_id', tableId)
      .eq('status', 'open');

    if (closeOrderError) throw closeOrderError;
    nextOrderId = null;
  }

  const updatePayload = action === 'open'
    ? {
        current_order_id: nextOrderId,
        status: 'occupied'
      }
    : {
        current_order_id: null,
        status: 'available'
      };

  const { data: updated, error: updateError } = await admin
    .from('tables')
    .update(updatePayload)
    .eq('id', tableId)
    .eq('business_id', tableRow.business_id)
    .select('id,business_id,current_order_id,status')
    .single();

  if (updateError) throw updateError;
  return updated;
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

  if (!SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY || !SUPABASE_URL) {
    res.status(500).json({ error: 'Supabase environment not configured' });
    return;
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { fetch });
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

    const { data, error } = await admin.rpc('open_close_table_transaction', {
      p_table_id: table_id,
      p_action: normalizedAction,
      p_user_id: user.id
    });

    let updated = null;
    if (error) {
    if (!isMissingOpenCloseTableRpcError(error) && !isMissingOpenedAtOnTablesError(error)) {
        throw error;
      }

      updated = await runLegacyOpenCloseTable({
        admin,
        tableId: table_id,
        action: normalizedAction,
        userId: user.id
      });
    } else {
      updated = Array.isArray(data) ? data[0] : data;
    }

    if (!updated) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    res.status(200).json({ ok: true, data: updated });
  } catch (err) {
    const status = mapRpcErrorToHttpStatus(err);
    res.status(status).json({ error: err?.message || 'server error' });
  }
}
