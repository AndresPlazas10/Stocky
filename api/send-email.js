/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export default async function handler(req, res) {
  // CORS mínimo para clientes web autenticados.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    const itemsHTML = items.map((item) => {
      const safeProductName = escapeHtml(item?.product_name || item?.name || 'Producto');
      const quantity = Number(item?.quantity || 0);
      const unitPrice = Number(item?.unit_price || 0);
      const lineTotal = quantity * unitPrice;

      return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${safeProductName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${unitPrice.toLocaleString('es-CO')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">$${lineTotal.toLocaleString('es-CO')}</td>
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
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="background: linear-gradient(135deg, #edb886 0%, #f1c691 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">${safeBusinessName}</h1>
              <p style="color: #f9f9f1; margin: 10px 0 0 0; font-size: 16px;">Comprobante de Pago #${safeInvoiceNumber}</p>
              <p style="color: #f9f9f1; margin: 5px 0 0 0; font-size: 12px;">Documento Informativo</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #edb886; margin-top: 0;">Hola ${safeCustomerName},</h2>
              <p style="color: #666; font-size: 16px;">Gracias por tu compra. Aquí está el detalle de tu comprobante:</p>
              <div style="background-color: #f0f0f0; padding: 12px; border-radius: 5px; margin: 15px 0;">
                <p style="margin: 0; color: #666; font-size: 14px;"><strong>Fecha de Emisión:</strong> ${issuedAt ? new Date(issuedAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('es-CO')}</p>
              </div>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background-color: #edb886; color: white;">
                    <th style="padding: 12px 8px; text-align: left;">Producto</th>
                    <th style="padding: 12px 8px; text-align: center;">Cant.</th>
                    <th style="padding: 12px 8px; text-align: right;">Precio</th>
                    <th style="padding: 12px 8px; text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
              <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-top: 20px;">
                <p style="margin: 0; font-size: 20px; font-weight: bold; color: #edb886; text-align: right;">
                  Total: $${numericTotal.toLocaleString('es-CO')}
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Gracias por confiar en ${safeBusinessName}</p>
              <p style="margin: 0 0 8px 0; color: #999; font-size: 12px;">Este es un email automático, por favor no responder.</p>
              <p style="margin: 0; color: #888; font-size: 11px; font-style: italic;">
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
        from: process.env.RESEND_FROM_EMAIL || 'Stocky <onboarding@resend.dev>',
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
