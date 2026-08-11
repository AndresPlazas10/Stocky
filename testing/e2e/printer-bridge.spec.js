import { test, expect } from '@playwright/test';
import { signIn, waitForPageReady } from './helpers/test-utils.js';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Impresora termica (Print Bridge)', () => {
  test.beforeEach(async ({ page }) => {
    if (TEST_EMAIL && TEST_PASSWORD) {
      await signIn(page, TEST_EMAIL, TEST_PASSWORD);
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    } else {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    }
  });

  const openPrinterSection = async (page) => {
    await waitForPageReady(page);
    const settingsLink = page.locator('a:has-text("Configuracion"), a:has-text("Configuración")').first();
    if (await settingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(500);
    }
  };

  test('muestra la seccion de impresora termica en Configuracion', async ({ page }) => {
    await openPrinterSection(page);

    const section = page.locator('text=Impresora termica').first();
    const visible = await section.isVisible({ timeout: 8000 }).catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('muestra los controles de configuracion del bridge', async ({ page }) => {
    await openPrinterSection(page);

    const endpointInput = page.locator('input[placeholder="http://127.0.0.1:41780"]').first();
    const testPrintButton = page.locator('button:has-text("Imprimir prueba"), button:has-text("Imprimir prueba")').first();

    const endpointVisible = await endpointInput.isVisible({ timeout: 8000 }).catch(() => false);
    const buttonVisible = await testPrintButton.isVisible({ timeout: 3000 }).catch(() => false);

    expect(endpointVisible).toBeTruthy();
    expect(buttonVisible).toBeTruthy();
  });

  test('permite cambiar el ancho de papel', async ({ page }) => {
    await openPrinterSection(page);

    const widthButton = page.locator('button:has-text("80mm")').first();
    if (await widthButton.isVisible({ timeout: 8000 }).catch(() => false)) {
      await widthButton.click();

      const persisted = await page.evaluate(() => window.localStorage.getItem('stocky_printer_paper_width_mm'));
      expect(persisted).toBe('80');
    }
  });
});
