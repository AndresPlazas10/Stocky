# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-pages.spec.js >> Páginas públicas >> la página de términos carga correctamente
- Location: testing/e2e/public-pages.spec.js:12:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Términos/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/Términos/i)

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Páginas públicas', () => {
  4  |   test('la página de descargas carga correctamente', async ({ page }) => {
  5  |     await page.goto('/descargar');
  6  |     await page.waitForLoadState('networkidle');
  7  | 
  8  |     await expect(page.locator('h1')).toBeVisible();
  9  |     await expect(page.getByText(/Descarga/i)).toBeVisible();
  10 |   });
  11 | 
  12 |   test('la página de términos carga correctamente', async ({ page }) => {
  13 |     await page.goto('/terminos');
  14 |     await page.waitForLoadState('networkidle');
  15 | 
> 16 |     await expect(page.getByText(/Términos/i)).toBeVisible();
     |                                               ^ Error: expect(locator).toBeVisible() failed
  17 |     // Verify [Nombre de la Empresa] was replaced
  18 |     const content = await page.content();
  19 |     expect(content).not.toContain('[Nombre de la Empresa]');
  20 |     expect(content).toContain('Stocky');
  21 |   });
  22 | 
  23 |   test('la página de términos usa el correo correcto', async ({ page }) => {
  24 |     await page.goto('/terminos');
  25 |     await page.waitForLoadState('networkidle');
  26 | 
  27 |     const content = await page.content();
  28 |     expect(content).toContain('soporte@stockypos.app');
  29 |     expect(content).not.toContain('soporte@stockly.com');
  30 |   });
  31 | 
  32 |   test('las páginas legales existen', async ({ page }) => {
  33 |     const legalPaths = [
  34 |       '/legal/terms.html',
  35 |       '/legal/privacy.html',
  36 |       '/legal/delete-account.html',
  37 |     ];
  38 | 
  39 |     for (const path of legalPaths) {
  40 |       const response = await page.goto(path);
  41 |       expect(response.status()).toBe(200);
  42 |     }
  43 |   });
  44 | 
  45 |   test('las páginas legales no contienen placeholders', async ({ page }) => {
  46 |     await page.goto('/legal/terms.html');
  47 |     const content = await page.content();
  48 |     expect(content).not.toContain('[Nombre');
  49 |   });
  50 | });
  51 | 
```