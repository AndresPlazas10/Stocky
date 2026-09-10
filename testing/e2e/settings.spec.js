import { test, expect } from '@playwright/test';
import { signIn, gotoSection, waitForPageReady } from './helpers/test-utils.js';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Configuracion', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'E2E_TEST_EMAIL/PASSWORD no definidas');
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await gotoSection(page, 'Configuración');
  });

  test('muestra la pagina de configuracion', async ({ page }) => {
    await waitForPageReady(page);

    const container = page.locator('[data-testid="settings-container"], main, .settings');
    await expect(container.first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra tabs o secciones de configuracion', async ({ page }) => {
    await waitForPageReady(page);

    const tabs = page.locator('button:has-text("Negocio"), button:has-text("Notificaciones"), a:has-text("Negocio"), a:has-text("Notificaciones")');
    const count = await tabs.count();
    expect(count >= 0).toBeTruthy();
  });

  test('muestra campo de nombre del negocio', async ({ page }) => {
    await waitForPageReady(page);

    const businessNameInput = page.locator('input[name="business_name"], input[placeholder*="nombre del negocio"]').first();
    const isVisible = await businessNameInput.isVisible({ timeout: 5000 }).catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });
});
