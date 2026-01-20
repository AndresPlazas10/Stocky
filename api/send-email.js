// api/send-email.js - Vercel Serverless Function
export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ VALIDAR que la API Key esté configurada
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ 
        error: 'Resend no está configurado. Configura RESEND_API_KEY en las variables de entorno de Vercel.',
        configured: false 
      });
    }

    const { email, invoiceNumber, customerName, total, items, businessName, issuedAt } = req.body;

    // Validar datos requeridos
    if (!email || !invoiceNumber || !customerName || !total || !items) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos: email, invoiceNumber, customerName, total, items' 
      });
    }

    // Formatear items
    const itemsHTML = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name || item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.unit_price.toLocaleString('es-CO')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">$${(item.quantity * item.unit_price).toLocaleString('es-CO')}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comprobante de Pago ${invoiceNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="background: linear-gradient(135deg, #edb886 0%, #f1c691 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">${businessName}</h1>
              <p style="color: #f9f9f1; margin: 10px 0 0 0; font-size: 16px;">Comprobante de Pago #${invoiceNumber}</p>
              <p style="color: #f9f9f1; margin: 5px 0 0 0; font-size: 12px;">Documento Informativo</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #edb886; margin-top: 0;">Hola ${customerName},</h2>
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
                  Total: $${total.toLocaleString('es-CO')}
                </p>
              </div>
              
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Gracias por confiar en ${businessName}</p>
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

    // Llamar a Resend desde el servidor (sin CORS)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Stocky <onboarding@resend.dev>',
        to: [email],
        subject: `Comprobante de Pago ${invoiceNumber} - ${businessName}`,
        html: htmlContent,
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API Error:', data);
      throw new Error(data.message || 'Error al enviar email con Resend API');
    }

    return res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('Error en send-email function:', error);
    return res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
}
