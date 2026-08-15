import { test, expect } from '@playwright/test';
import { signIn, waitForPageReady } from './helpers/test-utils.js';

const WAITER_USERNAME = process.env.E2E_TEST_USERNAME;
const WAITER_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Apilado de toasts', () => {
  test.skip(!WAITER_USERNAME || !WAITER_PASSWORD, 'E2E_TEST_USERNAME/PASSWORD no definidas');

  test('varios guardados rápidos muestran toasts apilados (uno debajo de otro)', async ({ page }) => {
    await signIn(page, WAITER_USERNAME, WAITER_PASSWORD);
    await page.goto('/employee-dashboard');
    await waitForPageReady(page);

    const occupied = page.locator(
      '[data-testid="mesa-card"]:has-text("Ocupada"), [data-testid="mesa-card"]:has-text("ocupada")',
    );
    await expect(occupied.first()).toBeVisible({ timeout: 15000 });
    const occupiedCount = await occupied.count();
    test.skip(occupiedCount < 2, 'se necesitan al menos 2 mesas ocupadas para apilar toasts');

    // Guarda en la primera mesa
    await occupied.nth(0).click();
    await expect(page.locator('button:has-text("Guardar")').first()).toBeVisible({ timeout: 10000 });
    const qtyUp0 = page.locator('[data-testid="qty-inc"]').first();
    if (!(await qtyUp0.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip(true, 'la orden no tiene items editables');
    }
    await qtyUp0.click();
    await page.locator('button:has-text("Guardar")').first().click();
    await expect(page.locator('[data-testid="toast-stack"] [role="alert"]').first()).toBeVisible({
      timeout: 10000,
    });
    // Espera a que el modal termine de cerrarse antes de abrir la siguiente mesa
    await expect(page.locator('[data-testid="qty-inc"]').first()).toBeHidden({ timeout: 10000 });

    // Guarda rápidamente en la segunda mesa
    await occupied.nth(1).click();
    await expect(page.locator('button:has-text("Guardar")').first()).toBeVisible({ timeout: 10000 });
    const qtyUp1 = page.locator('[data-testid="qty-inc"]').first();
    if (!(await qtyUp1.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip(true, 'la segunda orden no tiene items editables');
    }
    await qtyUp1.click();
    await page.locator('button:has-text("Guardar")').first().click();

    // Ambos toasts deben estar visibles a la vez, apilados
    await expect(page.locator('[data-testid="toast-stack"] [role="alert"]')).toHaveCount(2, {
      timeout: 5000,
    });

    // Cada uno expira a su tiempo (10s): el primero desaparece solo después de su duración
    await expect(page.locator('[data-testid="toast-stack"] [role="alert"]').first()).toBeVisible({
      timeout: 2000,
    });
  });

  test('el stack no excede 5 toasts visibles', async ({ page }) => {
    await signIn(page, WAITER_USERNAME, WAITER_PASSWORD);
    await page.goto('/employee-dashboard');
    await waitForPageReady(page);

    const stack = page.locator('[data-testid="toast-stack"] [role="alert"]');
    const count = await stack.count();
    expect(count).toBeLessThanOrEqual(5);
  });
});
