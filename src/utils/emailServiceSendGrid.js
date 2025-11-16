/**
 * 📧 Servicio de Email con SendGrid
 * 
 * SendGrid es usado por: Uber, Airbnb, Spotify
 * - 99% deliverability
 * - Dashboard con analytics avanzados
 * - Infraestructura global
 * - Mejor para grandes volúmenes
 * 
 * Precio:
 * - Gratis: 100 emails/día (3,000/mes)
 * - Essentials: $19.95/mes → 50,000 emails/mes
 * - Pro: $89.95/mes → 1.5M emails/mes
 * 
 * Setup:
 * 1. npm install @sendgrid/mail
 * 2. Regístrate en https://sendgrid.com
 * 3. Verifica tu dominio
 * 4. Crea API Key
 * 5. Configura en .env.local:
 *    VITE_SENDGRID_API_KEY=SG.xxxxx
 *    VITE_SENDGRID_FROM_EMAIL=noreply@tudominio.com
 */

import sgMail from '@sendgrid/mail';
import { 
  validateEmail, 
  shouldSendEmail, 
  logEmailAttempt 
} from './emailValidation';

// Configurar API Key
sgMail.setApiKey(import.meta.env.VITE_SENDGRID_API_KEY);

/**
 * Envía factura por email usando SendGrid
 */
export const sendInvoiceEmailSendGrid = async ({ 
  email, 
  invoiceNumber, 
  customerName, 
  total,
  items = [],
  businessName = 'Stockly'
}) => {
  try {
    // ✅ Validación
    const validation = validateEmail(email);
    if (!validation.valid) {
      logEmailAttempt({
        email,
        type: 'invoice',
        success: false,
        error: validation.error,
        skipped: true
      });
      return { success: false, error: validation.error };
    }

    // ✅ Decidir destinatario
    const sendDecision = shouldSendEmail(email);
    if (!sendDecision.shouldSend) {
      logEmailAttempt({
        email,
        type: 'invoice',
        success: false,
        error: sendDecision.reason,
        skipped: true
      });
      return { success: false, error: sendDecision.reason };
    }

    const targetEmail = sendDecision.testEmail || sendDecision.email;
    const isTestMode = !!sendDecision.testEmail;

    // ✅ Formatear items
    const itemsHTML = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name || item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.unit_price.toLocaleString('es-CO')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">$${(item.quantity * item.unit_price).toLocaleString('es-CO')}</td>
      </tr>
    `).join('');

    // ✅ Template HTML (igual que Resend)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Factura ${invoiceNumber}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          ${isTestMode ? `
          <tr>
            <td style="background-color: #ff9800; color: white; padding: 12px; text-align: center; font-weight: bold;">
              🧪 TEST MODE - Email original: ${email}
            </td>
          </tr>
          ` : ''}
          
          <tr>
            <td style="background: linear-gradient(135deg, #003B46 0%, #07575B 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">${businessName}</h1>
              <p style="color: #C4DFE6; margin: 10px 0 0 0;">Factura Electrónica</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 20px;">
              <p style="margin: 0 0 20px 0;">Hola <strong>${customerName}</strong>,</p>
              <p style="margin: 0 0 20px 0;">Gracias por tu compra. Adjuntamos los detalles de tu factura:</p>
              
              <table width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px; padding: 15px;">
                <tr>
                  <td><strong>Número:</strong></td>
                  <td style="text-align: right;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td><strong>Fecha:</strong></td>
                  <td style="text-align: right;">${new Date().toLocaleDateString('es-CO')}</td>
                </tr>
                <tr>
                  <td><strong>Total:</strong></td>
                  <td style="text-align: right; color: #003B46; font-size: 20px; font-weight: bold;">$${total.toLocaleString('es-CO')}</td>
                </tr>
              </table>

              <h2 style="color: #003B46; font-size: 18px; margin: 30px 0 15px 0;">Detalle de Productos</h2>
              <table width="100%" style="border-collapse: collapse;">
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
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; font-size: 14px;">Gracias por confiar en ${businessName}</p>
              <p style="margin: 0; color: #999; font-size: 12px;">Email automático, no responder.</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // ✅ Enviar con SendGrid
    const msg = {
      to: targetEmail,
      from: {
        email: import.meta.env.VITE_SENDGRID_FROM_EMAIL || 'noreply@stockly.app',
        name: businessName
      },
      subject: `Factura ${invoiceNumber} - ${businessName}`,
      html: htmlContent,
      text: `Factura ${invoiceNumber}\n\nCliente: ${customerName}\nTotal: $${total.toLocaleString('es-CO')}\n\nGracias por tu compra.`,
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: true }
      }
    };

    const response = await sgMail.send(msg);

    // ✅ Log exitoso
    logEmailAttempt({
      email: targetEmail,
      type: 'invoice',
      success: true
    });

    console.log('✅ Email enviado con SendGrid:', response[0].statusCode);

    return {
      success: true,
      testMode: isTestMode,
      targetEmail,
      originalEmail: email,
      data: response[0]
    };

  } catch (error) {
    console.error('❌ Error al enviar con SendGrid:', error);
    
    logEmailAttempt({
      email,
      type: 'invoice',
      success: false,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verifica si SendGrid está configurado
 */
export const isSendGridConfigured = () => {
  return !!(import.meta.env.VITE_SENDGRID_API_KEY && 
            import.meta.env.VITE_SENDGRID_FROM_EMAIL);
};
