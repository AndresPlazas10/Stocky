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
import { validateBody, NotifyLowStockSchema } from './_lib/validation.js';
import { pushLimiter } from './_lib/rateLimit.js';

const LOW_STOCK_THRESHOLD = 10;
const DEFAULT_MIN_STOCK = 5;
const LOW_STOCK_LIMIT = 5;

function resolveMinStock(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  return DEFAULT_MIN_STOCK;
}

function normalizeIdArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)));
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
    const validation = validateBody(NotifyLowStockSchema, req, res);
    if (!validation.success) return;

    const token = getBearerToken(req);
    if (!token) {
      sendError(res, 401, 'Missing bearer token');
      return;
    }

    const { business_id, product_ids } = validation.data;
    const businessId = normalizeText(business_id);
    const productIds = normalizeIdArray(product_ids);

    const user = await getUserFromToken(token);
    const admin = createSupabaseAdmin();

    const businessResult = await admin
      .from('businesses')
      .select('id,created_by')
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

    const isOwner = adminUserId === user.id;
    if (!isOwner) {
      const employeeResult = await admin
        .from('employees')
        .select('id,user_id,is_active')
        .eq('business_id', businessId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (employeeResult.error) throw employeeResult.error;
      if (!employeeResult.data?.id) {
        sendError(res, 403, 'Forbidden: user has no access to notify this event');
        return;
      }
    }

    let lowStockQuery = admin
      .from('products')
      .select('id,name,stock,min_stock,manage_stock')
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (productIds.length > 0) {
      lowStockQuery = lowStockQuery.in('id', productIds);
    } else {
      lowStockQuery = lowStockQuery
        .lt('stock', LOW_STOCK_THRESHOLD)
        .order('stock', { ascending: true })
        .limit(LOW_STOCK_LIMIT);
    }

    const lowStockResult = await lowStockQuery;
    if (lowStockResult.error) throw lowStockResult.error;

    const rawProducts = Array.isArray(lowStockResult.data) ? lowStockResult.data : [];
    const lowStockProducts = rawProducts
      .filter((product) => {
        if (product?.manage_stock === false) return false;
        const stockValue = Number(product?.stock);
        if (!Number.isFinite(stockValue)) return false;
        const minStockValue = resolveMinStock(product?.min_stock);
        return stockValue <= minStockValue;
      })
      .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
      .slice(0, LOW_STOCK_LIMIT);
    if (lowStockProducts.length === 0) {
      sendSuccess(res, {
        notified: 0,
        skipped: 'no_low_stock_products',
      });
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

    const messages = [];
    for (const product of lowStockProducts) {
      const productName = normalizeText(product?.name, 'Producto');
      const stockValue = Number.isFinite(Number(product?.stock)) ? Number(product.stock) : 0;
      for (const pushToken of uniqueExpoTokens) {
        messages.push({
          to: pushToken,
          sound: 'default',
          priority: 'high',
          channelId: 'stocky-default',
          title: 'Stock bajo',
          body: `${productName} tiene solo ${stockValue} unidades`,
          data: {
            type: 'low_stock',
            business_id: businessId,
            product_id: normalizeText(product?.id),
            stock: stockValue,
            threshold: LOW_STOCK_THRESHOLD,
          },
        });
      }
    }

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

    const webPushNotifications = lowStockProducts.map((product) => {
      const productName = normalizeText(product?.name, 'Producto');
      const stockValue = Number.isFinite(Number(product?.stock)) ? Number(product.stock) : 0;
      return {
        title: 'Stock bajo',
        body: `${productName} tiene solo ${stockValue} unidades`,
        data: {
          type: 'low_stock',
          business_id: businessId,
          product_id: normalizeText(product?.id),
          stock: stockValue,
          threshold: LOW_STOCK_THRESHOLD,
          url: '/dashboard',
        },
      };
    });

    const webPushErrors = [];
    const invalidWebEndpoints = [];
    let webPushSent = 0;

    for (const payload of webPushNotifications) {
      const webPushResult = await sendWebPushNotifications({
        subscriptions: webSubscriptionsById.map((item) => item.subscription),
        payload,
      });
      webPushSent += webPushResult.sent;
      webPushErrors.push(webPushResult.errors);
      if (Array.isArray(webPushResult.invalidEndpoints)) {
        invalidWebEndpoints.push(...webPushResult.invalidEndpoints);
      }
    }

    const uniqueInvalidWebEndpoints = Array.from(new Set(invalidWebEndpoints));

    if (uniqueInvalidWebEndpoints.length > 0) {
      const idsToDeactivate = webSubscriptionsById
        .filter((item) => {
          const endpoint = normalizeText(item.subscription?.endpoint);
          return endpoint && uniqueInvalidWebEndpoints.includes(endpoint);
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
      notified: messages.length + webPushSent,
      expoNotified: messages.length,
      webNotified: webPushSent,
      products: lowStockProducts.length,
      ticketCount: tickets.length,
      ticketErrors: errorCount,
      invalidatedTokens: invalidTokens.length,
      invalidatedWebSubscriptions: uniqueInvalidWebEndpoints.length,
      webPushErrors: webPushErrors.reduce((acc, value) => acc + Number(value || 0), 0),
    });
  } catch (error) {
    const status = error?.message === 'Unauthorized' ? 401 : 500;
    sendError(res, status, error?.message || 'server error');
  }
}
