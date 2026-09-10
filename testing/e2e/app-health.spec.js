import { test, expect } from '@playwright/test';

test.describe('Estado de la aplicación', () => {
  test('carga la página principal sin errores', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
    await expect(page.locator('#root')).toBeVisible();
  });

  test('tiene meta tags PWA correctamente configuradas', async ({ page }) => {
    await page.goto('/');
    const manifest = page.locator('link[rel="manifest"]').first();
    await expect(manifest).toBeAttached();

    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toBeAttached();
  });

  test('no tiene errores de consola fatales', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      const locationUrl = msg.location()?.url || '';
      const isKnownNoise =
        msg.text().includes('favicon')
        // Runtime de Spline (tercero) en la landing
        || msg.text().includes('Missing property')
        // Scripts de Vercel Analytics no existen fuera de Vercel
        || locationUrl.includes('/_vercel/insights/')
        || locationUrl.includes('/_vercel/speed-insights/');

      if (msg.type() === 'error' && !isKnownNoise) {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors.length).toBe(0);
  });
});
