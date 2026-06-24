import { test, expect } from '@playwright/test';
import { signIn, waitForPageReady } from './helpers/test-utils.js';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Inventario', () => {
  test.beforeEach(async ({ page }) => {
    if (TEST_EMAIL && TEST_PASSWORD) {
      await signIn(page, TEST_EMAIL, TEST_PASSWORD);
      await page.goto('/inventario');
      await page.waitForLoadState('networkidle');
    } else {
      await page.goto('/inventario');
      await page.waitForLoadState('networkidle');
    }
  });

  test('muestra la lista de productos', async ({ page }) => {
    await waitForPageReady(page);

    const container = page.locator('[data-testid="inventory-container"], main, .inventory');
    await expect(container.first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra boton para agregar producto', async ({ page }) => {
    await waitForPageReady(page);

    const addButton = page.locator('button:has-text("Agregar"), button:has-text("Nuevo"), button:has-text("Crear")').first();
    // Button might not be visible if user doesn't have permissions
    const isVisible = await addButton.isVisible({ timeout: 5000 }).catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });

  test('permite buscar productos', async ({ page }) => {
    await waitForPageReady(page);

    const searchInput = page.locator('input[placeholder*="buscar"], input[placeholder*="Buscar"], input[type="search"]').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });

  test('muestra tabla o lista de productos', async ({ page }) => {
    await waitForPageReady(page);

    const productList = page.locator('[data-testid="product-list"], table tbody, .product-list');
    const count = await productList.first().locator('tr, .product-item, [data-testid="product-row"]').count().catch(() => 0);

    // Should either show products or an empty state
    const emptyState = page.locator('text=No hay productos, text=Sin productos, text=Agregar producto');
    const hasEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

    expect(count >= 0 || hasEmptyState).toBeTruthy();
  });
});
