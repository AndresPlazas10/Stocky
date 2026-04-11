// ============================================
// 📧 Supabase Edge Function para Resend
// ============================================
// Ubicación: supabase/functions/send-email/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPPORT_EMAIL = 'soporte@stockypos.app'
const SUPPORT_FROM = `Stocky <${SUPPORT_EMAIL}>`

serve(async (req) => {
  // Permitir CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { email, invoiceNumber, customerName, total, items, businessName } = await req.json()
    const safeBusinessName = businessName || 'Stocky'
    const safeCustomerName = customerName || 'Cliente'
    const safeInvoiceNumber = invoiceNumber || 'N/A'
    const numericTotal = Number(total || 0)

    // Formatear items HTML
    const itemsHTML = items.map((item: any) => `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e6e8ef; color: #111827;">${item.product_name || item.name}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e6e8ef; text-align: center; color: #374151;">${item.quantity}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e6e8ef; text-align: right; color: #374151;">$${item.unit_price.toLocaleString('es-CO')}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #e6e8ef; text-align: right; font-weight: 700; color: #0f172a;">$${(item.quantity * item.unit_price).toLocaleString('es-CO')}</td>
      </tr>
    `).join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comprobante ${safeInvoiceNumber}</title>
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f3f5fb; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 680px; margin: 0 auto; border-collapse: collapse;">
          <tr>
            <td style="background-color: #0f172a; border-radius: 14px 14px 0 0; padding: 30px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
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
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px; color: #0f172a; font-weight: 600;">${new Date().toLocaleDateString('es-CO')}</td>
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
    `

    // Enviar con Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: SUPPORT_FROM,
        to: [email],
        subject: `Comprobante de Pago ${safeInvoiceNumber} - ${safeBusinessName}`,
        html: htmlContent,
      }),
    })

    const data = await res.json()

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  }
})
