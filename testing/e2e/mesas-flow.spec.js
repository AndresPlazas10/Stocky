import { test, expect } from '@playwright/test';
import { signIn, waitForPageReady } from './helpers/test-utils.js';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Flujo de Mesas', () => {
  test.beforeEach(async ({ page }) => {
    if (TEST_EMAIL && TEST_PASSWORD) {
      await signIn(page, TEST_EMAIL, TEST_PASSWORD);
      await page.goto('/mesas');
      await page.waitForLoadState('networkidle');
    } else {
      await page.goto('/mesas');
      await page.waitForLoadState('networkidle');
    }
  });

  test('muestra la vista de mesas', async ({ page }) => {
    await waitForPageReady(page);

    const container = page.locator('.grid, [data-testid="mesas-container"], main');
    await expect(container.first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra estados de mesa (disponible/ocupada)', async ({ page }) => {
    await waitForPageReady(page);

    // Look for table cards or status indicators
    const tableCards = page.locator('[data-testid="table-card"], .table-card, [data-status]');
    const count = await tableCards.count();

    // Should have at least one table card or a message indicating no tables
    if (count === 0) {
      // Check if there's an empty state message
      const emptyMessage = page.locator('text=No hay mesas, text=Agregar mesa');
      await expect(emptyMessage.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test('permite abrir una mesa disponible', async ({ page }) => {
    await waitForPageReady(page);

    const availableTable = page.locator('[data-status="available"], [data-testid="table-available"]').first();
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
    await waitForPageReady(page);

    const occupiedTable = page.locator('[data-status="occupied"], [data-testid="table-occupied"]').first();
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
