/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_ORIGIN = process.env.VITE_APP_URL;
const SUPPORT_EMAIL = 'soporte@stockypos.app';
const SUPPORT_FROM = `Stocky <${SUPPORT_EMAIL}>`;
const DEFAULT_PUBLIC_ORIGIN = 'https://www.stockypos.app';

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
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });

  const { data, error } = await authClient.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Unauthorized');
  }

  return data.user;
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
      .limit(1)
  ]);

  return (owner && owner.length > 0) || (employee && employee.length > 0);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractEmailAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

function resolveFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL;
  const configuredAddress = extractEmailAddress(configured);

  // Seguridad: nunca usar correos personales por configuración accidental.
  if (configuredAddress === SUPPORT_EMAIL) {
    return String(configured).trim().includes('<')
      ? String(configured).trim()
      : SUPPORT_FROM;
  }

  return SUPPORT_FROM;
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        error: 'Resend no está configurado. Configura RESEND_API_KEY en Vercel.',
        configured: false
      });
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase environment not configured' });
    }

    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const user = await getUserFromToken(token);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { fetch });

    const {
      email,
      invoiceNumber,
      customerName,
      total,
      items,
      businessName,
      businessId,
      issuedAt
    } = req.body || {};

    if (!email || !invoiceNumber || !customerName || total === null || total === undefined || !Array.isArray(items)) {
      return res.status(400).json({
        error: 'Faltan datos requeridos: email, invoiceNumber, customerName, total, items'
      });
    }

    if (!businessId) {
      return res.status(400).json({ error: 'Missing businessId' });
    }

    const canAccess = await userCanAccessBusiness(admin, user.id, businessId);
    if (!canAccess) {
      return res.status(403).json({ error: 'Forbidden for this business' });
    }

    const numericTotal = Number(total) || 0;
    const safeBusinessName = escapeHtml(businessName || 'Stocky');
    const safeCustomerName = escapeHtml(customerName);
    const safeInvoiceNumber = escapeHtml(invoiceNumber);
    const publicOrigin = normalizeOrigin(APP_ORIGIN) || DEFAULT_PUBLIC_ORIGIN;
    const brandLogoUrl = `${publicOrigin}/branding/logoStocky.png`;
    const formattedIssuedAt = issuedAt
      ? new Date(issuedAt).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      : new Date().toLocaleDateString('es-CO');

    const itemsHTML = items.map((item) => {
      const safeProductName = escapeHtml(item?.product_name || item?.name || 'Producto');
      const quantity = Number(item?.quantity || 0);
      const unitPrice = Number(item?.unit_price || 0);
      const lineTotal = quantity * unitPrice;

      return `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e6e8ef; color: #111827;">${safeProductName}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e6e8ef; text-align: center; color: #374151;">${quantity}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e6e8ef; text-align: right; color: #374151;">$${unitPrice.toLocaleString('es-CO')}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e6e8ef; text-align: right; font-weight: 700; color: #0f172a;">$${lineTotal.toLocaleString('es-CO')}</td>
      </tr>
    `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comprobante de Pago ${safeInvoiceNumber}</title>
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f3f5fb; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 680px; margin: 0 auto; border-collapse: collapse;">
          <tr>
            <td style="background-color: #0f172a; border-radius: 14px 14px 0 0; padding: 30px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <img src="${brandLogoUrl}" alt="Stocky" width="46" height="46" style="display: block; width: 46px; height: 46px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.25);" />
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; letter-spacing: 0.8px; color: #cbd5e1; text-transform: uppercase;">Stocky POS</td>
                </tr>
                <tr>
                  <td style="padding-top: 10px; font-size: 30px; font-weight: 700; color: #ffffff; line-height: 1.2;">${safeBusinessName}</td>
                </tr>
                <tr>
                  <td style="padding-top: 10px; font-size: 15px; color: #dbeafe;">Comprobante de pago #${safeInvoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding-top: 8px; font-size: 12px; color: #94a3b8;">Documento informativo</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; padding: 28px;">
              <p style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">Hola ${safeCustomerName},</p>
              <p style="margin: 10px 0 22px 0; font-size: 15px; color: #4b5563; line-height: 1.6;">
                Gracias por tu compra. Aquí tienes el detalle de tu comprobante.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 18px; background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px;">
                <tr>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #64748b;">Fecha de emision</td>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px; color: #0f172a; font-weight: 600;">${formattedIssuedAt}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; font-size: 13px; color: #64748b;">Total pagado</td>
                  <td style="padding: 14px 16px; text-align: right; font-size: 24px; color: #c78b33; font-weight: 700;">$${numericTotal.toLocaleString('es-CO')}</td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #111827; color: #ffffff;">
                    <th style="padding: 12px 10px; text-align: left; font-size: 12px; letter-spacing: 0.4px; text-transform: uppercase;">Producto</th>
                    <th style="padding: 12px 10px; text-align: center; font-size: 12px; letter-spacing: 0.4px; text-transform: uppercase;">Cant.</th>
                    <th style="padding: 12px 10px; text-align: right; font-size: 12px; letter-spacing: 0.4px; text-transform: uppercase;">Precio</th>
                    <th style="padding: 12px 10px; text-align: right; font-size: 12px; letter-spacing: 0.4px; text-transform: uppercase;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 14px 14px; padding: 20px 28px;">
              <p style="margin: 0 0 8px 0; color: #0f172a; font-size: 14px; font-weight: 600;">Gracias por confiar en ${safeBusinessName}</p>
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px;">Este es un correo automático, por favor no responder.</p>
              <p style="margin: 0; color: #6b7280; font-size: 11px; line-height: 1.5;">
                El presente comprobante es informativo. La responsabilidad tributaria recae exclusivamente en el establecimiento emisor.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: resolveFromAddress(),
        to: [email],
        subject: `Comprobante de Pago ${invoiceNumber} - ${businessName || 'Stocky'}`,
        html: htmlContent
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || 'Error al enviar email con Resend API');
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error?.message === 'Unauthorized' ? 401 : 500;
    return res.status(status).json({
      error: error?.message || 'server error'
    });
  }
}
