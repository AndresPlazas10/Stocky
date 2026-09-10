import { test, expect } from '@playwright/test';

test.describe('Modo Offline', () => {
  test('muestra banner de offline cuando no hay conexion', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await context.setOffline(true);

    const offlineBanner = page
      .locator('[data-testid="offline-banner"], [data-testid="offline"], [role="alert"]')
      .first();
    await expect(offlineBanner).toBeVisible({ timeout: 5000 });

    await context.setOffline(false);
  });

  test('la app funciona sin errores en modo offline', async ({ page, context }) => {
    const errors = [];
    page.on('pageerror', (error) => {
      if (!error.message.includes('ResizeObserver') && !/network|fetch/i.test(error.message)) {
        errors.push(error.message);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await context.setOffline(true);
    await page.waitForTimeout(2000);
    await context.setOffline(false);

    expect(errors.length).toBe(0);
  });
});
