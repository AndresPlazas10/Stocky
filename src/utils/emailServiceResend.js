/**
 * 📧 Servicio de Email con Resend
 * 
 * Envía comprobantes de venta (NO facturas electrónicas) por email.
 * 
 * IMPORTANTE: Los comprobantes enviados NO tienen validez ante DIAN.
 * Para facturación electrónica oficial, usar Siigo directamente.
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
 *    RESEND_API_KEY=re_xxxxx
 *    VITE_RESEND_FROM_EMAIL=soporte@stockypos.app
 * 
 * Ver guía completa: RESEND_SETUP.md
 */

import { 
  validateEmail, 
  shouldSendEmail, 
  logEmailAttempt 
} from './emailValidation';
import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';

/**
 * Envía comprobante de venta por email usando Resend API vía Vercel Function
 * IMPORTANTE: Este NO es una factura electrónica válida ante DIAN
 * Usa la API serverless de Vercel para proteger la API key
 */
export const sendInvoiceEmailResend = async ({ 
  email, 
  invoiceNumber, 
  customerName, 
  total,
  items = [],
  businessName = 'Stocky',
  businessId,
  issuedAt = null
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
    const _htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comprobante ${invoiceNumber}</title>
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
            <td style="background: linear-gradient(135deg, #edb886 0%, #f1c691 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">${businessName}</h1>
              <p style="color: #f9f9f1; margin: 10px 0 0 0;">Comprobante de Venta</p>
              <p style="color: #fff8e1; margin: 5px 0 0 0; font-size: 11px;">Documento NO válido ante DIAN</p>
            </td>
          </tr>

          <!-- Invoice Info -->
          <tr>
            <td style="padding: 30px 20px;">
              <p style="margin: 0 0 20px 0; color: #666;">Hola <strong>${customerName}</strong>,</p>
              <p style="margin: 0 0 20px 0; color: #666;">Gracias por tu compra. Adjuntamos los detalles de tu comprobante de venta:</p>
              
              <table width="100%" style="margin: 20px 0; background-color: #f9f9f9; border-radius: 8px; padding: 15px;">
                <tr>
                  <td style="padding: 5px;"><strong>Número de Comprobante:</strong></td>
                  <td style="padding: 5px; text-align: right;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 5px;"><strong>Fecha de Emisión:</strong></td>
                  <td style="padding: 5px; text-align: right;">${issuedAt ? new Date(issuedAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('es-CO')}</td>
                </tr>
                <tr>
                  <td style="padding: 5px;"><strong>Total:</strong></td>
                  <td style="padding: 5px; text-align: right; color: #edb886; font-size: 20px; font-weight: bold;">$${total.toLocaleString('es-CO')}</td>
                </tr>
              </table>

              <!-- Items Table -->
              <h2 style="color: #edb886; font-size: 18px; margin: 30px 0 15px 0;">Detalle de Productos</h2>
              <table width="100%" style="border-collapse: collapse;">
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
              
              <!-- Disclaimer Legal -->
              <div style="margin: 30px 0; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; color: #856404; font-size: 13px; font-weight: bold;">
                  ⚠️ INFORMACIÓN LEGAL IMPORTANTE
                </p>
                <p style="margin: 0 0 5px 0; color: #856404; font-size: 12px;">
                  ✗ Este comprobante NO es una factura electrónica<br>
                  ✗ NO tiene validez fiscal ante la DIAN<br>
                  ✗ NO es deducible de impuestos
                </p>
                <p style="margin: 10px 0 0 0; color: #856404; font-size: 11px; font-style: italic;">
                  Para factura electrónica oficial, solicitarla directamente al establecimiento.
                </p>
              </div>
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

    // ✅ PASO 5: Enviar con Resend API (a través de función serverless)
    // En desarrollo usar base configurable y fallback relativo (proxy de Vite).
    const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
    const apiUrl = apiBaseUrl
      ? `${apiBaseUrl}/api/send-email`
      : '/api/send-email';

    const { data: sessionData } = await supabaseAdapter.getCurrentSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      throw new Error('Sesión inválida para enviar correo');
    }

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          email: targetEmail,
          invoiceNumber,
          customerName,
          total,
          items,
          businessName,
          businessId,
          issuedAt
        })
      });
    } catch (_networkError) {
      throw new Error(
        `No se pudo conectar al servicio de correo (${apiUrl}). ` +
        'Configura VITE_API_BASE_URL o habilita el proxy /api en Vite.'
      );
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const data = contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };

    if (!response.ok) {
      // Mensaje de error más claro
      const errorMessage = data.configured === false 
        ? '⚠️ Resend no está configurado. Por favor configura las variables de entorno RESEND_API_KEY y RESEND_FROM_EMAIL.'
        : data.error || data.message || 'Error al enviar email con Resend';
      
      throw new Error(errorMessage);
    }

    // ✅ PASO 6: Log exitoso
    logEmailAttempt({
      email: targetEmail,
      type: 'invoice',
      success: true
    });

    return {
      success: true,
      testMode: isTestMode,
      targetEmail,
      originalEmail: email,
      data
    };

  } catch (error) {
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
export const isResendConfigured = (env = import.meta.env || {}) => {
  const providerHint = String(env.VITE_EMAIL_PROVIDER || 'auto').trim().toLowerCase();
  if (providerHint === 'emailjs') return false;

  const explicitDisable = String(env.VITE_RESEND_ENABLED || '').trim().toLowerCase();
  if (explicitDisable === 'false' || explicitDisable === '0') return false;

  // No dependemos de API key ni from-email en frontend para evitar exponer secretos.
  // La validación definitiva ocurre en /api/send-email con variables server-side.
  // Si no está explícitamente deshabilitado, preferimos Resend para mantener remitente corporativo.
  return true;
};
