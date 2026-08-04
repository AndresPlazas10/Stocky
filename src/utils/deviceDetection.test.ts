import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { redirectAfterRegistration } from './deviceDetection';

describe('redirectAfterRegistration', () => {
  const originalLocation = window.location;
  let hrefValue = '';
  let assignValue = '';

  beforeEach(() => {
    hrefValue = '';
    assignValue = '';
    const mockLocation = {
      set href(value: string) {
        hrefValue = value;
      },
      get href() {
        return hrefValue;
      },
      assign(value: string) {
        assignValue = value;
      },
    };
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: mockLocation,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.unstubAllEnvs();
  });

  it('redirects Android users to Play Store', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)' });

    redirectAfterRegistration();

    expect(assignValue).toBe(
      'https://play.google.com/store/apps/details?id=app.stockypos&hl=es_CO',
    );
  });

  it('uses custom Play Store URL when provided', () => {
    vi.stubEnv('VITE_PLAY_STORE_URL', 'https://play.google.com/store/apps/details?id=custom.app');
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)' });

    redirectAfterRegistration();

    expect(assignValue).toBe('https://play.google.com/store/apps/details?id=custom.app');
  });

  it('redirects iOS users to the web dashboard', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });

    redirectAfterRegistration();

    expect(assignValue).toBe('/dashboard');
  });

  it('redirects desktop users to the web dashboard', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });

    redirectAfterRegistration();

    expect(assignValue).toBe('/dashboard');
  });

  it('detects Android via userAgentData platform hint', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      userAgentData: { platform: 'Android' },
    });

    redirectAfterRegistration();

    expect(assignValue).toBe(
      'https://play.google.com/store/apps/details?id=app.stockypos&hl=es_CO',
    );
  });
});
