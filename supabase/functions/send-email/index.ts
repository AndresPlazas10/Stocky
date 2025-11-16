// ============================================
// 📧 Supabase Edge Function para Resend
// ============================================
// Ubicación: supabase/functions/send-email/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

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

    // Formatear items HTML
    const itemsHTML = items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name || item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.unit_price.toLocaleString('es-CO')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">$${(item.quantity * item.unit_price).toLocaleString('es-CO')}</td>
      </tr>
    `).join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Factura ${invoiceNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="background: linear-gradient(135deg, #003B46 0%, #07575B 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">${businessName}</h1>
              <p style="color: #C4DFE6; margin: 10px 0 0 0; font-size: 16px;">Factura #${invoiceNumber}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #003B46; margin-top: 0;">Hola ${customerName},</h2>
              <p style="color: #666; font-size: 16px;">Gracias por tu compra. Aquí está el detalle de tu factura:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background-color: #003B46; color: white;">
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
                <p style="margin: 0; font-size: 20px; font-weight: bold; color: #003B46; text-align: right;">
                  Total: $${total.toLocaleString('es-CO')}
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Gracias por confiar en ${businessName}</p>
              <p style="margin: 0; color: #999; font-size: 12px;">Este es un email automático, por favor no responder.</p>
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
        from: 'Stockly <onboarding@resend.dev>',
        to: [email],
        subject: `Factura ${invoiceNumber} - ${businessName}`,
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
