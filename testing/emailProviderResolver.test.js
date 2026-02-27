import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMAIL_PROVIDERS,
  normalizeProviderPreference,
  resolveEmailProviderFromConfig,
} from '../src/utils/emailProviderResolver.js';

test('prioriza Resend en modo auto cuando ambos proveedores estan listos', () => {
  const provider = resolveEmailProviderFromConfig({
    providerHint: 'auto',
    resendReady: true,
    emailJsReady: true,
  });

  assert.equal(provider, EMAIL_PROVIDERS.RESEND);
});

test('respeta preferencia emailjs cuando esta configurado', () => {
  const provider = resolveEmailProviderFromConfig({
    providerHint: 'emailjs',
    resendReady: true,
    emailJsReady: true,
  });

  assert.equal(provider, EMAIL_PROVIDERS.EMAILJS);
});

test('hace fallback a EmailJS cuando preferencia es resend pero Resend no esta listo', () => {
  const provider = resolveEmailProviderFromConfig({
    providerHint: 'resend',
    resendReady: false,
    emailJsReady: true,
  });

  assert.equal(provider, EMAIL_PROVIDERS.EMAILJS);
});

test('devuelve None cuando ningun proveedor esta configurado', () => {
  const provider = resolveEmailProviderFromConfig({
    providerHint: 'auto',
    resendReady: false,
    emailJsReady: false,
  });

  assert.equal(provider, EMAIL_PROVIDERS.NONE);
});

test('normaliza valores invalidos de providerHint a auto', () => {
  assert.equal(normalizeProviderPreference('  RANDOM '), 'auto');
});

