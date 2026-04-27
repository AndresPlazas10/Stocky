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

const toBoolean = (value, fallback = false) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const isProductionBuild = () => {
  const mode = String(import.meta.env?.MODE || '').trim().toLowerCase();
  return import.meta.env?.PROD === true || mode === 'production';
};

const isResendOnlyEnforced = () => {
  // En producción, por defecto forzamos solo Resend para evitar remitentes no corporativos.
  return toBoolean(import.meta.env?.VITE_ENFORCE_RESEND_ONLY, isProductionBuild());
};

const isEmailJsFallbackAllowed = () => {
  // Por defecto NO hacemos fallback a EmailJS para evitar remitentes personales (ej. Gmail).
  return toBoolean(import.meta.env?.VITE_ALLOW_EMAILJS_FALLBACK, false);
};

export const resolveEmailProvider = ({
  providerHint = import.meta.env?.VITE_EMAIL_PROVIDER,
  resendReady = isResendConfigured(),
  emailJsReady = isEmailJSConfigured(),
} = {}) => {
  return resolveEmailProviderFromConfig({ providerHint, resendReady, emailJsReady });
};

export const sendInvoiceEmail = async (params) => {
  const provider = resolveEmailProvider();
  const enforceResendOnly = isResendOnlyEnforced();
  const allowEmailJsFallback = isEmailJsFallbackAllowed();

  if (enforceResendOnly && provider !== EMAIL_PROVIDERS.RESEND) {
    return {
      success: false,
      provider,
      error: 'Email bloqueado: en este entorno solo se permite Resend. Configura RESEND_API_KEY y RESEND_FROM_EMAIL.',
    };
  }

  if (provider === EMAIL_PROVIDERS.RESEND) {
    const resendResult = await sendInvoiceEmailResend(params);
    if (resendResult?.success) {
      return {
        ...resendResult,
        provider: EMAIL_PROVIDERS.RESEND,
      };
    }

    if (enforceResendOnly || !allowEmailJsFallback) {
      return {
        ...resendResult,
        provider: EMAIL_PROVIDERS.RESEND,
        fallbackBlocked: true,
        error: resendResult?.error || 'No se pudo enviar con Resend. El fallback a EmailJS está deshabilitado.',
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
