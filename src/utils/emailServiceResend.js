/**
 * 📧 Servicio de Email con Resend
 * 
 * Resend es el proveedor recomendado para aplicaciones modernas.
 * - 99.9% deliverability
 * - Dashboard con analytics
 * - Sin límites de rate en plan Pro
 * - Mejor reputación que EmailJS
 * 
 * Precio:
 * - Gratis: 3,000 emails/mes (100/día)
 * - Pro: $20/mes → 50,000 emails/mes
 * 
 * Setup:
 * 1. Regístrate en https://resend.com
 * 2. Obtén API Key
 * 3. Configura en .env.local:
 *    VITE_RESEND_API_KEY=re_xxxxx
 *    VITE_RESEND_FROM_EMAIL=onboarding@resend.dev
 * 
 * Ver guía completa: RESEND_SETUP.md
 */

import { 
  validateEmail, 
  shouldSendEmail, 
  logEmailAttempt 
} from './emailValidation';

/**
 * Envía factura por email usando Resend API
 * Usa fetch() directo (compatible con navegador y Edge Functions)
 */
export const sendInvoiceEmailResend = async ({ 
  email, 
  invoiceNumber, 
  customerName, 
  total,
  items = [],
  businessName = 'Stockly'
}) => {
  try {
    // ✅ PASO 1: Validar email
    const validation = validateEmail(email);
    
    if (!validation.valid) {
      logEmailAttempt({
        email,
        type: 'invoice',
        success: false,
        error: validation.error,
        skipped: true
      });
      
      return {
        success: false,
        error: validation.error
      };
    }

    // ✅ PASO 2: Decidir destinatario (test vs real)
    const sendDecision = shouldSendEmail(email);
    
    if (!sendDecision.shouldSend) {
      logEmailAttempt({
        email,
        type: 'invoice',
        success: false,
        error: sendDecision.reason,
        skipped: true
      });
      
      return {
        success: false,
        error: sendDecision.reason
      };
    }

    const targetEmail = sendDecision.testEmail || sendDecision.email;
    const isTestMode = !!sendDecision.testEmail;
    
    // Log para debugging
    if (isTestMode) {
      console.log(`🧪 [TEST MODE] Factura ${invoiceNumber} enviada a email de prueba`);
    } else {
      console.log(`✅ [PRODUCTION] Factura ${invoiceNumber} enviada a cliente`);
    }

    // ✅ PASO 3: Formatear items
    const itemsHTML = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name || item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.unit_price.toLocaleString('es-CO')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">$${(item.quantity * item.unit_price).toLocaleString('es-CO')}</td>
      </tr>
    `).join('');

    // ✅ PASO 4: Template HTML profesional
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Factura ${invoiceNumber}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          ${isTestMode ? `
          <tr>
            <td style="background-color: #ff9800; color: white; padding: 12px; text-align: center; font-weight: bold;">
              🧪 TEST MODE - Email original: ${email}
            </td>
          </tr>
          ` : ''}
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #003B46 0%, #07575B 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">${businessName}</h1>
              <p style="color: #C4DFE6; margin: 10px 0 0 0;">Factura Electrónica</p>
            </td>
          </tr>

          <!-- Invoice Info -->
          <tr>
            <td style="padding: 30px 20px;">
              <p style="margin: 0 0 20px 0; color: #666;">Hola <strong>${customerName}</strong>,</p>
              <p style="margin: 0 0 20px 0; color: #666;">Gracias por tu compra. Adjuntamos los detalles de tu factura:</p>
              
              <table width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px; padding: 15px;">
                <tr>
                  <td style="padding: 5px;"><strong>Número de Factura:</strong></td>
                  <td style="padding: 5px; text-align: right;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 5px;"><strong>Fecha:</strong></td>
                  <td style="padding: 5px; text-align: right;">${new Date().toLocaleDateString('es-CO')}</td>
                </tr>
                <tr>
                  <td style="padding: 5px;"><strong>Total:</strong></td>
                  <td style="padding: 5px; text-align: right; color: #003B46; font-size: 20px; font-weight: bold;">$${total.toLocaleString('es-CO')}</td>
                </tr>
              </table>

              <!-- Items Table -->
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

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Gracias por confiar en ${businessName}</p>
              <p style="margin: 0; color: #999; font-size: 12px;">Este es un email automático, por favor no responder.</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // ✅ PASO 5: Enviar con Resend API (a través de Vercel Function para evitar CORS)
    const apiUrl = import.meta.env.DEV 
      ? 'http://localhost:3000/api/send-email'  // Desarrollo local
      : '/api/send-email';  // Producción en Vercel

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: targetEmail,
        invoiceNumber,
        customerName,
        total,
        items,
        businessName
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error al enviar email con Resend');
    }

    // ✅ PASO 6: Log exitoso
    logEmailAttempt({
      email: targetEmail,
      type: 'invoice',
      success: true
    });

    if (isTestMode) {
      console.log(`✅ [TEST] Email enviado a ${targetEmail} (original: ${email})`);
    } else {
      console.log(`✅ [PROD] Email enviado con Resend a ${targetEmail}`);
    }

    return {
      success: true,
      testMode: isTestMode,
      targetEmail,
      originalEmail: email,
      data
    };

  } catch (error) {
    console.error('❌ Error al enviar con Resend:', error);
    
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
 * Verifica si Resend está configurado
 */
export const isResendConfigured = () => {
  return !!(import.meta.env.VITE_RESEND_API_KEY && 
            import.meta.env.VITE_RESEND_FROM_EMAIL);
};
