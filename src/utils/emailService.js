/**
 * 🎯 Servicio Unificado de Email
 * 
 * Envía comprobantes de venta por email (NO facturas electrónicas).
 * 
 * IMPORTANTE: Los comprobantes enviados NO tienen validez ante DIAN.
 * Para facturación electrónica oficial, usar Siigo directamente.
 * 
 * Detecta automáticamente qué proveedor usar según la configuración:
 * 1. Resend (si está configurado) - Óptimo para alto volumen (3,000/mes)
 * 2. EmailJS (fallback) - Funciona en producción (200/mes)
 * 
 * Ambos proveedores funcionan tanto en desarrollo como en producción.
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
 * Usando EmailJS (Resend deshabilitado porque requiere dominio verificado)
 */
export const sendInvoiceEmail = async (params) => {
  // Usar EmailJS directamente
  // Resend está deshabilitado porque requiere verificar dominio
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
