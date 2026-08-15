import { test, expect } from '@playwright/test';
import { signIn, waitForPageReady } from './helpers/test-utils.js';

const WAITER_USERNAME = process.env.E2E_TEST_USERNAME;
const WAITER_PASSWORD = process.env.E2E_TEST_PASSWORD;
const KITCHEN_USERNAME = process.env.E2E_KITCHEN_USERNAME;
const KITCHEN_PASSWORD = process.env.E2E_KITCHEN_PASSWORD;

test.describe('Alerta "orden lista" (call) contra meseros', () => {
  test.skip(
    !WAITER_USERNAME || !WAITER_PASSWORD || !KITCHEN_USERNAME || !KITCHEN_PASSWORD,
    'faltan credenciales E2E_TEST_USERNAME/PASSWORD o E2E_KITCHEN_USERNAME/PASSWORD',
  );

  async function pickKitchenCallTarget(page, excludeLabel) {
    const callButtons = page.locator('[data-testid="mesa-card"]:has-text("Llamar") button:has-text("Llamar")');
    const count = await callButtons.count();
    for (let i = 0; i < count; i++) {
      const card = callButtons.nth(i).locator('xpath=ancestor::*[@data-testid="mesa-card"]');
      const label = (await card.locator('h3').innerText()).trim();
      if (label !== excludeLabel) {
        return { button: callButtons.nth(i), label };
      }
    }
    return null;
  }

  async function dismissWaiterBell(page) {
    // El bell anima en loop (rotate infinito) y Playwright lo ve "inestable": force
    const bell = page.locator('[aria-label="Cocina te está llamando"]').first();
    if (await bell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bell.click({ force: true });
    }
  }

  test('mesero que inicia sesión con un call pendiente NO recibe toast, solo el bell', async ({ browser }) => {
    const kitchenCtx = await browser.newContext();
    const waiterCtx = await browser.newContext();
    const kitchen = await kitchenCtx.newPage();
    const waiter = await waiterCtx.newPage();

    try {
      // Cocina: llama a una mesa (deja call_requested_at en la DB)
      await signIn(kitchen, KITCHEN_USERNAME, KITCHEN_PASSWORD);
      await kitchen.goto('/employee-dashboard');
      await waitForPageReady(kitchen);

      const target = await pickKitchenCallTarget(kitchen, '');
      test.skip(!target, 'no hay mesas ocupadas con botón Llamar');
      await target.button.click();
      await expect(kitchen.locator('text=Llamado enviado').first()).toBeVisible({ timeout: 10000 });

      // Mesero: inicia sesión DESPUÉS del call
      await signIn(waiter, WAITER_USERNAME, WAITER_PASSWORD);
      await waiter.goto('/employee-dashboard');
      await waitForPageReady(waiter);

      // El toast "Orden lista" NO debe aparecer en los primeros segundos
      await waiter.waitForTimeout(4000);
      const toastText = await waiter.locator('[data-testid="toast-stack"]').innerText().catch(() => '');
      expect(toastText).not.toContain('Orden lista');

      // El bell debe estar visible en la tarjeta de la mesa llamada
      const bellCard = waiter
        .locator('[aria-label="Cocina te está llamando"]')
        .first()
        .locator('xpath=ancestor::*[@data-testid="mesa-card"]');
      await expect(bellCard.locator('h3')).toHaveText(target.label, { timeout: 15000 });

      // Cleanup: el mesero descarta el call para no contaminar corridas futuras
      await dismissWaiterBell(waiter);
    } finally {
      await kitchenCtx.close();
      await waiterCtx.close();
    }
  });

  test('mesero logueado SÍ recibe toast cuando la cocina llama', async ({ browser }) => {
    const kitchenCtx = await browser.newContext();
    const waiterCtx = await browser.newContext();
    const kitchen = await kitchenCtx.newPage();
    const waiter = await waiterCtx.newPage();

    try {
      // Mesero: sesión activa primero
      await signIn(waiter, WAITER_USERNAME, WAITER_PASSWORD);
      await waiter.goto('/employee-dashboard');
      await waitForPageReady(waiter);

      // Cocina: llama a una mesa
      await signIn(kitchen, KITCHEN_USERNAME, KITCHEN_PASSWORD);
      await kitchen.goto('/employee-dashboard');
      await waitForPageReady(kitchen);

      const target = await pickKitchenCallTarget(kitchen, '');
      test.skip(!target, 'no hay mesas ocupadas con botón Llamar');
      await target.button.click();

      // El mesero activo recibe EXACTAMENTE UN toast "Orden lista"
      await expect(waiter.locator('text=Orden lista').first()).toBeVisible({ timeout: 20000 });
      await waiter.waitForTimeout(3000);
      expect(await waiter.locator('text=Orden lista').count()).toBe(1);

      // Cleanup: dismiss del bell si quedó (el auto-dismiss del toast debería limpiar la DB)
      await dismissWaiterBell(waiter);
    } finally {
      await kitchenCtx.close();
      await waiterCtx.close();
    }
  });
});
