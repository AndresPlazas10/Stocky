import { test, expect } from '@playwright/test';

test.describe('Páginas públicas', () => {
  test('la página de descargas carga correctamente', async ({ page }) => {
    await page.goto('/descargar');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText(/Descarga/i)).toBeVisible();
  });

  test('la página de términos carga correctamente', async ({ page }) => {
    await page.goto('/terminos');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Términos/i)).toBeVisible();
    // Verify [Nombre de la Empresa] was replaced
    const content = await page.content();
    expect(content).not.toContain('[Nombre de la Empresa]');
    expect(content).toContain('Stocky');
  });

  test('la página de términos usa el correo correcto', async ({ page }) => {
    await page.goto('/terminos');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    expect(content).toContain('soporte@stockypos.app');
    expect(content).not.toContain('soporte@stockly.com');
  });

  test('las páginas legales existen', async ({ page }) => {
    const legalPaths = [
      '/legal/terms.html',
      '/legal/privacy.html',
      '/legal/delete-account.html',
    ];

    for (const path of legalPaths) {
      const response = await page.goto(path);
      expect(response.status()).toBe(200);
    }
  });

  test('las páginas legales no contienen placeholders', async ({ page }) => {
    await page.goto('/legal/terms.html');
    const content = await page.content();
    expect(content).not.toContain('[Nombre');
  });
});
