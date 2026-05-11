# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app-health.spec.js >> Estado de la aplicación >> carga la página principal sin errores
- Location: testing/e2e/app-health.spec.js:4:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Estado de la aplicación', () => {
  4  |   test('carga la página principal sin errores', async ({ page }) => {
  5  |     const errors = [];
  6  |     page.on('pageerror', (error) => errors.push(error.message));
  7  | 
  8  |     await page.goto('/');
  9  |     await page.waitForLoadState('networkidle');
  10 | 
> 11 |     expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
     |                                                                      ^ Error: expect(received).toBe(expected) // Object.is equality
  12 |     await expect(page.locator('#root')).toBeVisible();
  13 |   });
  14 | 
  15 |   test('tiene meta tags PWA correctamente configuradas', async ({ page }) => {
  16 |     await page.goto('/');
  17 |     const manifest = page.locator('link[rel="manifest"]');
  18 |     await expect(manifest).toBeAttached();
  19 | 
  20 |     const themeColor = page.locator('meta[name="theme-color"]');
  21 |     await expect(themeColor).toBeAttached();
  22 |   });
  23 | 
  24 |   test('no tiene errores de consola fatales', async ({ page }) => {
  25 |     const errors = [];
  26 |     page.on('console', (msg) => {
  27 |       if (msg.type() === 'error' && !msg.text().includes('favicon')) {
  28 |         errors.push(msg.text());
  29 |       }
  30 |     });
  31 | 
  32 |     await page.goto('/');
  33 |     await page.waitForLoadState('networkidle');
  34 | 
  35 |     expect(errors.length).toBe(0);
  36 |   });
  37 | });
  38 | 
```