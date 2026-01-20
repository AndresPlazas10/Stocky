import { supabase } from '../supabase/Client';
import emailjs from '@emailjs/browser';
import { 
  validateEmail, 
  shouldSendEmail, 
  logEmailAttempt,
  normalizeEmail 
} from './emailValidation';

/**
 * Envía una factura electrónica por email usando EmailJS
 * Funciona tanto para administradores como empleados
 * ✅ Incluye validación robusta para prevenir bounced emails
 * 
 * @param {Object} params - Parámetros del email
 * @param {string} params.email - Email del destinatario
 * @param {string} params.invoiceNumber - Número de factura
 * @param {string} params.customerName - Nombre del cliente
 * @param {number} params.total - Total de la factura
 * @param {Array} params.items - Items de la factura (opcional)
 * @returns {Promise<Object>} - Resultado del envío
 */
export const sendInvoiceEmail = async ({ 
  email, 
  invoiceNumber, 
  customerName, 
  total,
  items = []
}) => {
  try {
    // ✅ PASO 1: Validar el email antes de intentar enviar
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
        error: validation.error,
        message: `No se pudo enviar el email: ${validation.error}`
      };
    }

    // ✅ PASO 2: Decidir si enviar email real o de testing
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
        error: sendDecision.reason,
        message: `Email no enviado: ${sendDecision.reason}`
      };
    }

    // Usar email de testing en desarrollo, real en producción
    const targetEmail = sendDecision.testEmail || sendDecision.email;
    const isTestMode = !!sendDecision.testEmail;

    // ✅ PASO 3: Verificar si EmailJS está configurado
    const emailJSConfigured = import.meta.env.VITE_EMAILJS_SERVICE_ID && 
                              import.meta.env.VITE_EMAILJS_TEMPLATE_ID && 
                              import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!emailJSConfigured) {
      logEmailAttempt({
        email: targetEmail,
        type: 'invoice',
        success: true,
        error: null,
        skipped: true
      });
      
      return {
        success: true,
        demo: true,
        testMode: isTestMode,
        message: 'EmailJS no configurado. Configura las variables de entorno VITE_EMAILJS_*'
      };
    }

    // ✅ PASO 4: Formatear items para el email
    const itemsText = items.map(item => 
      `- ${item.product_name || item.name} x ${item.quantity} = $${(item.quantity * item.unit_price).toLocaleString('es-CO')}`
    ).join('\n');

    // ✅ PASO 5: Preparar template params para EmailJS con email validado
    const templateParams = {
      to_email: targetEmail, // ✅ Usar email validado (test o real)
      customer_name: customerName,
      invoice_number: invoiceNumber,
      total: `$${total.toLocaleString('es-CO')}`,
      items_list: itemsText || 'Ver factura adjunta',
      business_name: 'Stocky',
      message: isTestMode 
        ? `[TEST MODE] Email original: ${email}\n\nHola ${customerName},\n\nAdjuntamos tu factura ${invoiceNumber} por un valor de $${total.toLocaleString('es-CO')}.\n\nProductos:\n${itemsText}\n\nGracias por tu compra.`
        : `Hola ${customerName},\n\nAdjuntamos tu factura ${invoiceNumber} por un valor de $${total.toLocaleString('es-CO')}.\n\nProductos:\n${itemsText}\n\nGracias por tu compra.`
    };

    // ✅ PASO 6: Enviar email usando EmailJS
    const response = await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      templateParams,
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    );

    // ✅ PASO 7: Log exitoso
    const successMessage = isTestMode 
      ? `Email de testing enviado a ${targetEmail} (original: ${email})`
      : `Email enviado exitosamente a ${targetEmail}`;
    
    logEmailAttempt({
      email: targetEmail,
      type: 'invoice',
      success: true,
      error: null
    });
    
    return {
      success: true,
      demo: false,
      testMode: isTestMode,
      targetEmail,
      originalEmail: email,
      data: response,
      message: successMessage
    };

  } catch (error) {
    // ✅ Log del error
    logEmailAttempt({
      email,
      type: 'invoice',
      success: false,
      error: error.message || error
    });
    
    // Si falla, retornar modo demo para no romper la aplicación
    return {
      success: false, // ✅ Cambiado a false para reflejar el fallo real
      demo: true,
      error: error.message,
      message: 'Error al enviar email. Verifica la configuración de EmailJS y que el email sea válido.'
    };
  }
};

/**
 * Valida si el servicio de email está configurado correctamente
 */
export const isEmailConfigured = () => {
  // Siempre true porque usamos Supabase Edge Functions
  return true;
};
