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
  sendExpoPushMessages,
  isExpoDeviceNotRegisteredTicket,
} from './_lib/pushProviders.js';
import { validateBody, NotifyEmployeeLoginSchema } from './_lib/validation.js';
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
    const validation = validateBody(NotifyEmployeeLoginSchema, req, res);
    if (!validation.success) return;

    const token = getBearerToken(req);
    if (!token) {
      sendError(res, 401, 'Missing bearer token');
      return;
    }

    const { business_id, employee_name } = validation.data;
    const businessId = normalizeText(business_id);

    const user = await getUserFromToken(token);
    const admin = createSupabaseAdmin();

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
      sendError(res, 403, 'Forbidden: only active employees can notify this event');
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
      sendError(res, 404, 'Business not found');
      return;
    }

    const adminUserId = normalizeText(businessResult.data.created_by);
    if (!adminUserId) {
      sendError(res, 500, 'Business admin user is not configured');
      return;
    }

    const pushTokensResult = await admin
      .from('mobile_push_tokens')
      .select('id,push_token,platform')
      .eq('user_id', adminUserId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (pushTokensResult.error) throw pushTokensResult.error;

    const pushRows = Array.isArray(pushTokensResult.data) ? pushTokensResult.data : [];
    const uniqueExpoTokens = Array.from(
      new Set(
        pushRows
          .filter((row) => normalizeText(row?.platform).toLowerCase() !== 'web')
          .map((row) => normalizeText(row?.push_token))
          .filter(Boolean),
      ),
    );

    const webSubscriptionsById = pushRows
      .filter((row) => normalizeText(row?.platform).toLowerCase() === 'web')
      .map((row) => ({
        id: row.id,
        subscription: parseWebPushSubscription(row?.push_token),
      }))
      .filter((item) => item.subscription);

    if (uniqueExpoTokens.length === 0 && webSubscriptionsById.length === 0) {
      sendSuccess(res, {
        notified: 0,
        skipped: 'admin_without_push_tokens',
      });
      return;
    }

    const fallbackEmployeeName = normalizeText(employeeResult.data.full_name)
      || normalizeText(employeeResult.data.username)
      || 'Un empleado';
    const employeeName = normalizeText(employee_name) || fallbackEmployeeName;
    const businessName = normalizeText(businessResult.data.name, 'tu negocio');

    const messages = uniqueExpoTokens.map((pushToken) => ({
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

    const tickets = messages.length > 0
      ? await sendExpoPushMessages(messages)
      : [];
    const invalidTokens = [];

    for (let index = 0; index < tickets.length; index += 1) {
      const ticket = tickets[index];
      if (!isExpoDeviceNotRegisteredTicket(ticket)) continue;
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

    const webPushResult = await sendWebPushNotifications({
      subscriptions: webSubscriptionsById.map((item) => item.subscription),
      payload: {
        title: 'Empleado conectado 💚',
        body: `${employeeName} inició sesion en ${businessName}`,
        data: {
          type: 'employee_login',
          business_id: businessId,
          employee_user_id: user.id,
          url: '/dashboard',
        },
      },
    });

    if (webPushResult.invalidEndpoints.length > 0) {
      const idsToDeactivate = webSubscriptionsById
        .filter((item) => {
          const endpoint = normalizeText(item.subscription?.endpoint);
          return endpoint && webPushResult.invalidEndpoints.includes(endpoint);
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

    const errorCount = tickets.filter((ticket) => normalizeText(ticket?.status).toLowerCase() === 'error').length;
    sendSuccess(res, {
      notified: uniqueExpoTokens.length + webPushResult.sent,
      expoNotified: uniqueExpoTokens.length,
      webNotified: webPushResult.sent,
      ticketCount: tickets.length,
      ticketErrors: errorCount,
      invalidatedTokens: invalidTokens.length,
      invalidatedWebSubscriptions: webPushResult.invalidEndpoints.length,
      webPushErrors: webPushResult.errors,
      webPushSkipped: webPushResult.skipped || null,
    });
  } catch (error) {
    const status = error?.message === 'Unauthorized' ? 401 : 500;
    sendError(res, status, error?.message || 'server error');
  }
}
