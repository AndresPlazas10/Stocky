import { test, expect } from '@playwright/test';
import { signIn, waitForPageReady } from './helpers/test-utils.js';

const WAITER_USERNAME = process.env.E2E_TEST_USERNAME;
const WAITER_PASSWORD = process.env.E2E_TEST_PASSWORD;
const KITCHEN_USERNAME = process.env.E2E_KITCHEN_USERNAME;
const KITCHEN_PASSWORD = process.env.E2E_KITCHEN_PASSWORD;

test.describe('Cocina ordenada por recencia', () => {
  test.skip(!KITCHEN_USERNAME || !KITCHEN_PASSWORD, 'E2E_KITCHEN_USERNAME/PASSWORD no definidas');

  test('la cocina carga y muestra mesas o empty state sin errores', async ({ page }) => {
    await signIn(page, KITCHEN_USERNAME, KITCHEN_PASSWORD);
    await page.goto('/employee-dashboard');
    await waitForPageReady(page);

    const grid = page.locator('[data-testid="mesa-card"]');
    const emptyState = page.locator('text=Sin pedidos en espera');
    await expect(grid.first().or(emptyState.first())).toBeVisible({ timeout: 15000 });
  });

  test.describe('recencia con pedidos existentes', () => {
    test.skip(
      !WAITER_USERNAME || !WAITER_PASSWORD,
      'E2E_TEST_USERNAME/PASSWORD (mesero) no definidas',
    );

    test('al guardar un pedido, salta al tope de la cocina y lleva el badge', async ({ browser }) => {
      const waiterContext = await browser.newContext();
      const kitchenContext = await browser.newContext();
      const waiter = await waiterContext.newPage();
      const kitchen = await kitchenContext.newPage();

      try {
        // Cocina: captura el orden inicial de las tarjetas ocupadas
        await signIn(kitchen, KITCHEN_USERNAME, KITCHEN_PASSWORD);
        await kitchen.goto('/employee-dashboard');
        await waitForPageReady(kitchen);
        const cards = kitchen.locator('[data-testid="mesa-card"]');
        const occupiedBefore = await cards.count();
        test.skip(occupiedBefore < 2, 'se necesitan al menos 2 mesas ocupadas para la prueba');

        const firstBefore = (await cards.nth(0).locator('h3').innerText()).trim();

        // Mesero: abre la mesa que está al FINAL del grid (la menos reciente)
        await signIn(waiter, WAITER_USERNAME, WAITER_PASSWORD);
        await waiter.goto('/employee-dashboard');
        await waitForPageReady(waiter);
        const waiterCards = waiter.locator('[data-testid="mesa-card"]');
        const occupied = waiter.locator('[data-testid="mesa-card"]:has-text("Ocupada"), [data-testid="mesa-card"]:has-text("ocupada")');
        await expect(occupied.first()).toBeVisible({ timeout: 15000 });

        const targetCard = occupied.last();
        const targetLabel = (await targetCard.locator('h3').innerText()).trim();
        await targetCard.click();

        // Espera a que el modal de la orden abra y cargue los items
        await expect(waiter.locator('button:has-text("Guardar")').first()).toBeVisible({
          timeout: 10000,
        });
        const qtyUp = waiter.locator('[data-testid="qty-inc"]').first();
        if (!(await qtyUp.isVisible({ timeout: 10000 }).catch(() => false))) {
          test.skip(true, 'la orden no tiene items editables');
        }
        await qtyUp.click();
        await waiter.locator('button:has-text("Guardar")').first().click();
        await expect(waiter.locator('[data-testid="qty-inc"]').first()).toBeHidden({
          timeout: 10000,
        });

        // La cocina reordena (via realtime o poll 5s + siembra de updated_at):
        // la mesa editada debe saltar al primer lugar.
        await expect(kitchen.locator('[data-testid="mesa-card"]').first().locator('h3')).toHaveText(
          targetLabel,
          { timeout: 25000 },
        );

        // El temporizador de la orden editada se reinició (≈ 00:0X desde el cambio)
        const firstCard = kitchen.locator('[data-testid="mesa-card"]').first();
        const timer = firstCard.locator('[data-testid="kitchen-order-timer"]');
        await expect(timer).toBeVisible({ timeout: 5000 });
        const timerText = (await timer.innerText()).trim();
        expect(timerText).toMatch(/^0\d:\d{2}$/);

        // Badge "Pedido más reciente" sobre la mesa editada (si realtime lo entregó)
        const badge = kitchen.locator('[data-testid="mesa-most-recent-badge"]');
        if (await badge.count()) {
          const badgeCard = badge.locator('xpath=ancestor::*[@data-testid="mesa-card"]').first();
          await expect(badgeCard.locator('h3')).toHaveText(targetLabel);
        }

        // Recarga: el orden debe mantenerse (persistido via updated_at)
        await kitchen.reload();
        await waitForPageReady(kitchen);
        await expect(kitchen.locator('[data-testid="mesa-card"]').first().locator('h3')).toHaveText(
          targetLabel,
          { timeout: 25000 },
        );

        // La mesa que antes era la primera deja de serlo (movimiento real)
        const firstAfter = (await kitchen.locator('[data-testid="mesa-card"]').nth(0).locator('h3').innerText()).trim();
        expect(firstAfter).not.toBe(firstBefore);
      } finally {
        await waiterContext.close();
        await kitchenContext.close();
      }
    });
  });
});
