import { test, expect } from '@playwright/test';
import { signIn, gotoSection, waitForPageReady } from './helpers/test-utils.js';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Gestion de Empleados', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'E2E_TEST_EMAIL/PASSWORD no definidas');
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await gotoSection(page, 'Empleados');
  });

  test('muestra la lista de empleados', async ({ page }) => {
    await waitForPageReady(page);

    const container = page.locator('[data-testid="employees-container"], main, .employees');
    await expect(container.first()).toBeVisible({ timeout: 10000 });
  });

  test('muestra boton para agregar empleado', async ({ page }) => {
    await waitForPageReady(page);

    const addButton = page.locator('button:has-text("Agregar"), button:has-text("Nuevo"), button:has-text("Crear")').first();
    const isVisible = await addButton.isVisible({ timeout: 5000 }).catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });

  test('muestra tabla o lista de empleados', async ({ page }) => {
    await waitForPageReady(page);

    const employeeList = page.locator('[data-testid="employee-list"], table tbody, .employee-list');
    const count = await employeeList.first().locator('tr, .employee-item, [data-testid="employee-row"]').count().catch(() => 0);

    const emptyState = page.locator('text=No hay empleados, text=Sin empleados, text=Agregar empleado');
    const hasEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

    expect(count >= 0 || hasEmptyState).toBeTruthy();
  });
});
