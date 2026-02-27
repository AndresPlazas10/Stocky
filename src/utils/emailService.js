/**
 * Servicio unificado de envio de comprobantes por email.
 *
 * Prioridad de proveedores:
 * 1. Resend (si esta configurado y habilitado)
 * 2. EmailJS (fallback)
 */

import { isResendConfigured, sendInvoiceEmailResend } from './emailServiceResend';
import {
  isEmailConfigured as isEmailJSConfigured,
  sendInvoiceEmail as sendInvoiceEmailJS,
} from './emailServiceSupabase';
import { EMAIL_PROVIDERS, resolveEmailProviderFromConfig } from './emailProviderResolver';

export const resolveEmailProvider = ({
  providerHint = import.meta.env?.VITE_EMAIL_PROVIDER,
  resendReady = isResendConfigured(),
  emailJsReady = isEmailJSConfigured(),
} = {}) => {
  return resolveEmailProviderFromConfig({ providerHint, resendReady, emailJsReady });
};

export const sendInvoiceEmail = async (params) => {
  const provider = resolveEmailProvider();

  if (provider === EMAIL_PROVIDERS.RESEND) {
    const resendResult = await sendInvoiceEmailResend(params);
    if (resendResult?.success) {
      return {
        ...resendResult,
        provider: EMAIL_PROVIDERS.RESEND,
      };
    }

    const fallbackResult = await sendInvoiceEmailJS(params);
    return {
      ...fallbackResult,
      provider: EMAIL_PROVIDERS.EMAILJS,
      fallbackFrom: EMAIL_PROVIDERS.RESEND,
      previousError: resendResult?.error || null,
    };
  }

  if (provider === EMAIL_PROVIDERS.EMAILJS) {
    const emailJsResult = await sendInvoiceEmailJS(params);
    return {
      ...emailJsResult,
      provider: EMAIL_PROVIDERS.EMAILJS,
    };
  }

  return {
    success: false,
    provider: EMAIL_PROVIDERS.NONE,
    error: 'No hay un proveedor de email configurado (Resend/EmailJS).',
  };
};

export const getEmailProvider = () => resolveEmailProvider();

export const isEmailServiceConfigured = () => {
  return resolveEmailProvider() !== EMAIL_PROVIDERS.NONE;
};
