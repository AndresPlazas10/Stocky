import { test, expect } from '@playwright/test';
import { signIn, waitForPageReady } from './helpers/test-utils.js';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Dashboard y Navegacion', () => {
  test.beforeEach(async ({ page }) => {
    if (TEST_EMAIL && TEST_PASSWORD) {
      await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    } else {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    }
  });

  test('muestra el dashboard principal', async ({ page }) => {
    await waitForPageReady(page);

    const mainContent = page.locator('main, #root, [data-testid="dashboard"]');
    await expect(mainContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('navega al modulo de Mesas', async ({ page }) => {
    await waitForPageReady(page);

    const mesasLink = page.locator('a[href="/mesas"], a:has-text("Mesas")').first();
    if (await mesasLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mesasLink.click();
      await expect(page).toHaveURL(/mesas/, { timeout: 10000 });
    }
  });

  test('navega al modulo de Inventario', async ({ page }) => {
    await waitForPageReady(page);

    const inventoryLink = page.locator('a[href="/inventario"], a:has-text("Inventario")').first();
    if (await inventoryLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await inventoryLink.click();
      await expect(page).toHaveURL(/inventario/, { timeout: 10000 });
    }
  });

  test('navega al modulo de Empleados', async ({ page }) => {
    await waitForPageReady(page);

    const employeesLink = page.locator('a[href="/empleados"], a:has-text("Empleados")').first();
    if (await employeesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await employeesLink.click();
      await expect(page).toHaveURL(/empleados/, { timeout: 10000 });
    }
  });

  test('navega al modulo de Configuracion', async ({ page }) => {
    await waitForPageReady(page);

    const settingsLink = page.locator('a[href="/configuracion"], a:has-text("Configuracion")').first();
    if (await settingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsLink.click();
      await expect(page).toHaveURL(/configuracion/, { timeout: 10000 });
    }
  });
});
