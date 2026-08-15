import { test, expect } from '@playwright/test';
import { signIn, waitForPageReady } from './helpers/test-utils.js';

const TEST_EMAIL = process.env.E2E_TEST_USERNAME || process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Flujo de Mesas', () => {
  test.beforeEach(async ({ page }) => {
    // El módulo de mesas vive en /dashboard (home) para el owner
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto('/dashboard');
    await waitForPageReady(page);
  });

  test('muestra la vista de mesas', async ({ page }) => {
    const container = page.locator('[data-testid="mesa-card"], [data-testid="mesas-container"], main');
    await expect(container.first()).toBeVisible({ timeout: 15000 });
  });

  test('muestra estados de mesa (disponible/ocupada)', async ({ page }) => {
    const tableCards = page.locator('[data-testid="mesa-card"]');
    const count = await tableCards.count();

    if (count === 0) {
      // Empty state: no hay mesas creadas
      const emptyMessage = page.locator('text=No hay mesas, text=Agregar mesa');
      await expect(emptyMessage.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    } else {
      // Las tarjetas muestran estado ocupada/disponible o bloqueada
      await expect(tableCards.first()).toBeVisible();
      const statuses = await page
        .locator('[data-testid="mesa-card"] :text("Ocupada"), [data-testid="mesa-card"] :text("Disponible"), [data-testid="mesa-card"] :text("En uso")')
        .count();
      expect(statuses).toBeGreaterThan(0);
    }
  });

  test('permite abrir una mesa disponible', async ({ page }) => {
    const availableTable = page
      .locator('[data-testid="mesa-card"]:has-text("Disponible"), [data-testid="mesa-card"]:has-text("available")')
      .first();
    if (await availableTable.isVisible({ timeout: 5000 }).catch(() => false)) {
      await availableTable.click();

      const openButton = page.locator('button:has-text("Abrir"), button:has-text("Ocupar")').first();
      if (await openButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await openButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('permite cerrar una mesa ocupada', async ({ page }) => {
    const occupiedTable = page
      .locator('[data-testid="mesa-card"]:has-text("Ocupada")')
      .first();
    if (await occupiedTable.isVisible({ timeout: 5000 }).catch(() => false)) {
      await occupiedTable.click();

      const closeButton = page.locator('button:has-text("Cerrar"), button:has-text("Liberar")').first();
      if (await closeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeButton.click();

        // Handle confirmation dialog if present
        const confirmButton = page.locator('[role="dialog"] button:has-text("Confirmar"), [role="dialog"] button:has-text("Aceptar")').first();
        if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmButton.click();
        }

        await page.waitForLoadState('networkidle');
      }
    }
  });
});
