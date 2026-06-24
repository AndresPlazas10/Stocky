/* eslint-env node */
import {
  applyCors,
  getBearerToken,
  getUserFromToken,
  createSupabaseAdmin,
  userCanAccessBusiness,
  isEnvConfigured,
  sendError,
  sendSuccess,
} from './_lib/apiUtils.js';
import { validateBody, OpenCloseTableSchema } from './_lib/validation.js';
import { tableLimiter } from './_lib/rateLimit.js';

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
    sendError(res, 405, 'Method not allowed');
    return;
  }

  const rateLimitResult = tableLimiter(req, res);
  if (rateLimitResult.blocked) {
    sendError(res, 429, rateLimitResult.message);
    return;
  }

  if (!isEnvConfigured()) {
    sendError(res, 500, 'Supabase environment not configured');
    return;
  }

  try {
    const validation = validateBody(OpenCloseTableSchema, req, res);
    if (!validation.success) return;

    const admin = createSupabaseAdmin();
    const token = getBearerToken(req);
    if (!token) {
      sendError(res, 401, 'Missing bearer token');
      return;
    }

    const user = await getUserFromToken(token);
    const { table_id, action } = validation.data;

    const { data, error } = await admin.rpc('open_close_table_transaction', {
      p_table_id: table_id,
      p_action: action,
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
        action,
        userId: user.id
      });
    } else {
      updated = Array.isArray(data) ? data[0] : data;
    }

    if (!updated) {
      sendError(res, 404, 'Table not found');
      return;
    }

    sendSuccess(res, { data: updated });
  } catch (err) {
    const status = mapRpcErrorToHttpStatus(err);
    sendError(res, status, err?.message || 'server error');
  }
}
