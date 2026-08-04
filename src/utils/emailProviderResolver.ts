export const EMAIL_PROVIDERS = {
  RESEND: 'Resend',
  EMAILJS: 'EmailJS',
  NONE: 'None',
};

export const normalizeProviderPreference = (providerHint = 'auto') => {
  const normalized = String(providerHint || '').trim().toLowerCase();
  if (normalized === 'resend') return 'resend';
  if (normalized === 'emailjs') return 'emailjs';
  return 'auto';
};

export const resolveEmailProviderFromConfig = ({
  providerHint = 'auto',
  resendReady = false,
  emailJsReady = false,
} = {}) => {
  const preference = normalizeProviderPreference(providerHint);

  if (preference === 'resend') {
    if (resendReady) return EMAIL_PROVIDERS.RESEND;
    if (emailJsReady) return EMAIL_PROVIDERS.EMAILJS;
    return EMAIL_PROVIDERS.NONE;
  }

  if (preference === 'emailjs') {
    if (emailJsReady) return EMAIL_PROVIDERS.EMAILJS;
    if (resendReady) return EMAIL_PROVIDERS.RESEND;
    return EMAIL_PROVIDERS.NONE;
  }

  if (resendReady) return EMAIL_PROVIDERS.RESEND;
  if (emailJsReady) return EMAIL_PROVIDERS.EMAILJS;
  return EMAIL_PROVIDERS.NONE;
};

