import { test, expect } from '@playwright/test';
import { signIn } from './helpers/test-utils.js';

test.describe('Autenticacion', () => {
  test('muestra formulario de login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('muestra error con credenciales invalidas', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('nonexistent@test.com');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('WrongPassword123!');

    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    // Should show an error message
    const errorMessage = page.locator('[role="alert"], .text-red-500, [data-testid="error-message"]');
    await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
  });

  test('navega a pagina de registro', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const registerLink = page.locator('a[href*="register"], a:has-text("Crear cuenta"), a:has-text("Registrate")');
    if (await registerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await registerLink.click();
      await expect(page).toHaveURL(/register/, { timeout: 10000 });
    }
  });
});
