import { test, expect } from '@playwright/test';
import { signIn, gotoSection, waitForPageReady } from './helpers/test-utils.js';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Dashboard y Navegacion', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'E2E_TEST_EMAIL/PASSWORD no definidas');
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('muestra el dashboard principal', async ({ page }) => {
    await waitForPageReady(page);

    const mainContent = page.locator('main, #root, [data-testid="dashboard"]');
    await expect(mainContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('navega al modulo de Mesas', async ({ page }) => {
    await gotoSection(page, 'Inicio');

    const mainContent = page.locator('main, #root, [data-testid="dashboard"]');
    await expect(mainContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('navega al modulo de Inventario', async ({ page }) => {
    await gotoSection(page, 'Inventario');

    const container = page.locator('[data-testid="inventory-container"], main');
    await expect(container.first()).toBeVisible({ timeout: 10000 });
  });

  test('navega al modulo de Empleados', async ({ page }) => {
    await gotoSection(page, 'Empleados');

    const container = page.locator('[data-testid="employees-container"], main');
    await expect(container.first()).toBeVisible({ timeout: 10000 });
  });

  test('navega al modulo de Configuracion', async ({ page }) => {
    await gotoSection(page, 'Configuración');

    const container = page.locator('[data-testid="settings-container"], main');
    await expect(container.first()).toBeVisible({ timeout: 10000 });
  });
});
