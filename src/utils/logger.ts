import * as Sentry from '@sentry/react';

const isDev = import.meta.env.DEV;

class Logger {
  private isDev: boolean;

  constructor() {
    this.isDev = isDev;
  }

  info(...args: unknown[]): void {
    if (this.isDev) {
      console.info(...args); // eslint-disable-line no-console
    }
  }

  warn(...args: unknown[]): void {
    if (this.isDev) {
      console.warn(...args); // eslint-disable-line no-console
    }
    const joined = args.map(a => String(a)).join(' ');
    const keyPrefixes = ['[perf]', '[realtime]', '[sync]', '[db]'];
    if (keyPrefixes.some(p => joined.startsWith(p))) {
      try {
        Sentry.captureMessage(joined, { level: 'warning' });
      } catch {
        // no-op
      }
    }
  }

  error(...args: unknown[]): void {
    if (this.isDev) {
      console.error(...args); // eslint-disable-line no-console
    }
    this.sendToMonitoring('error', args);
  }

  debug(...args: unknown[]): void {
    if (this.isDev) {
      console.debug(...args); // eslint-disable-line no-console
    }
  }

  success(...args: unknown[]): void {
    if (this.isDev) {
      console.log(...args); // eslint-disable-line no-console
    }
  }

  sendToMonitoring(level: string, data: unknown): void {
    try {
      const args = Array.isArray(data) ? data : [data];
      if (level === 'error') {
        Sentry.addBreadcrumb({
          category: 'logger.error',
          message: args.map(a => String(a)).join(' ').slice(0, 500),
          level: 'error',
        });
        const first = args[0];
        if (first instanceof Error) {
          Sentry.captureException(first, { extra: { allArgs: args } });
        } else {
          Sentry.captureMessage(args.map(a => String(a)).join(' '), { level: 'error', extra: { args } });
        }
      }
    } catch {
      // nunca lanzar desde monitoring
    }
  }
}

export const logger = new Logger();

export default logger;
