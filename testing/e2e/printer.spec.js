import { test, expect } from '@playwright/test';
import { signIn, gotoSection, waitForPageReady } from './helpers/test-utils.js';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Impresora (driver del sistema)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'E2E_TEST_EMAIL/PASSWORD no definidas');
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
  });

  const openPrinterSection = async (page) => {
    await gotoSection(page, 'Configuración');
    await waitForPageReady(page);
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
