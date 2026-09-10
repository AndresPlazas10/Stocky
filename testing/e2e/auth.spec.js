import { test, expect } from '@playwright/test';

test.describe('Autenticacion', () => {
  test('muestra formulario de login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('muestra error con credenciales invalidas', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.locator('#username').fill('nonexistent@test.com');
    await page.locator('input[type="password"]').fill('WrongPassword123!');

    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    // El error del login se muestra como toast (role="alert")
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('navega a pagina de registro', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const registerButton = page.getByRole('button', { name: /registrar negocio|register business/i });
    await registerButton.click();
    await expect(page).toHaveURL(/register/, { timeout: 10000 });
  });
});
