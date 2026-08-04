import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env?.VITE_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN || SENTRY_DSN === 'your_sentry_dsn_here') return;

  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env?.MODE || 'development',
    release: import.meta.env?.VITE_APP_VERSION || '1.0.0',
  });
}

export { Sentry };
