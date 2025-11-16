/**
 * 🎯 Servicio Unificado de Email
 * 
 * Detecta automáticamente qué proveedor usar según la configuración:
 * 1. Resend (si está configurado) - RECOMENDADO
 * 2. SendGrid (si está configurado)
 * 3. EmailJS (fallback actual)
 * 
 * Uso:
 * import { sendInvoiceEmail } from './emailService';
 * await sendInvoiceEmail({ email, invoiceNumber, customerName, total, items });
 */

import { sendInvoiceEmailResend, isResendConfigured } from './emailServiceResend';
import { sendInvoiceEmailSendGrid, isSendGridConfigured } from './emailServiceSendGrid';
import { sendInvoiceEmail as sendInvoiceEmailJS } from './emailServiceSupabase';

/**
 * Envía factura usando el mejor proveedor disponible
 * Prioridad: Resend > SendGrid > EmailJS
 */
export const sendInvoiceEmail = async (params) => {
  // 1. Intentar con Resend (mejor opción)
  if (isResendConfigured()) {
    console.log('📧 Usando Resend para envío de email...');
    return await sendInvoiceEmailResend(params);
  }

  // 2. Intentar con SendGrid
  if (isSendGridConfigured()) {
    console.log('📧 Usando SendGrid para envío de email...');
    return await sendInvoiceEmailSendGrid(params);
  }

  // 3. Fallback a EmailJS (actual)
  console.log('📧 Usando EmailJS para envío de email...');
  return await sendInvoiceEmailJS(params);
};

/**
 * Obtiene el proveedor de email activo
 */
export const getEmailProvider = () => {
  if (isResendConfigured()) return 'Resend';
  if (isSendGridConfigured()) return 'SendGrid';
  return 'EmailJS';
};

/**
 * Verifica que al menos un proveedor esté configurado
 */
export const isEmailServiceConfigured = () => {
  return isResendConfigured() || 
         isSendGridConfigured() || 
         !!(import.meta.env.VITE_EMAILJS_PUBLIC_KEY);
};
