import { test, expect } from '@playwright/test';
import { signIn, waitForPageReady } from './helpers/test-utils.js';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Impresora (driver del sistema)', () => {
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

  test('muestra la seccion de impresora en Configuracion', async ({ page }) => {
    await openPrinterSection(page);

    const section = page.locator('text=Impresión, text=Impresion').first();
    const visible = await section.isVisible({ timeout: 8000 }).catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('muestra la guia del driver', async ({ page }) => {
    await openPrinterSection(page);

    const guide = page.locator('text=driver, text=Driver').first();
    const visible = await guide.isVisible({ timeout: 8000 }).catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('muestra los controles de ancho de papel', async ({ page }) => {
    await openPrinterSection(page);

    const width58 = page.locator('button:has-text("58mm")').first();
    const width80 = page.locator('button:has-text("80mm")').first();

    const width58Visible = await width58.isVisible({ timeout: 8000 }).catch(() => false);
    expect(width58Visible).toBeTruthy();

    const width80Visible = await width80.isVisible({ timeout: 3000 }).catch(() => false);
    expect(width80Visible).toBeTruthy();
  });

  test('muestra el boton de imprimir prueba', async ({ page }) => {
    await openPrinterSection(page);

    const testPrintButton = page.locator('button:has-text("Imprimir prueba"), button:has-text("Test print")').first();
    const visible = await testPrintButton.isVisible({ timeout: 8000 }).catch(() => false);
    expect(visible).toBeTruthy();
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
