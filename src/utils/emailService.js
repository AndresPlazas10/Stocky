/**
 * 🎯 Servicio Unificado de Email
 * 
 * Envía comprobantes de venta por email (NO facturas electrónicas).
 * 
 * IMPORTANTE: Los comprobantes enviados NO tienen validez ante DIAN.
 * Para facturación electrónica oficial, usar Siigo directamente.
 * 
 * Detecta automáticamente qué proveedor usar según la configuración:
 * 1. Resend (si está configurado) - RECOMENDADO para producción
 * 2. EmailJS (fallback) - Solo para desarrollo/testing
 * 
 * Uso:
 * import { sendInvoiceEmail } from './emailService';
 * await sendInvoiceEmail({ email, invoiceNumber, customerName, total, items });
 */

import { sendInvoiceEmailResend, isResendConfigured } from './emailServiceResend';
import { sendInvoiceEmail as sendInvoiceEmailJS } from './emailServiceSupabase';

/**
 * Envía comprobante de venta usando el mejor proveedor disponible
 * IMPORTANTE: NO es factura electrónica válida ante DIAN
 * Prioridad: Resend > EmailJS
 */
export const sendInvoiceEmail = async (params) => {
  const provider = getEmailProvider();
  
  // 1. Intentar con Resend (mejor opción para producción)
  if (isResendConfigured()) {
    return await sendInvoiceEmailResend(params);
  }

  // 2. Fallback a EmailJS
  return await sendInvoiceEmailJS(params);
};

/**
 * Obtiene el proveedor de email activo
 */
export const getEmailProvider = () => {
  if (isResendConfigured()) return 'Resend';
  return 'EmailJS';
};

/**
 * Verifica que al menos un proveedor esté configurado
 */
export const isEmailServiceConfigured = () => {
  return isResendConfigured() || 
         !!(import.meta.env.VITE_EMAILJS_PUBLIC_KEY);
};
