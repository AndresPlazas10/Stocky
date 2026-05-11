# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-pages.spec.js >> Páginas públicas >> la página de términos usa el correo correcto
- Location: testing/e2e/public-pages.spec.js:23:3

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "soporte@stockypos.app"
Received string:    "<!DOCTYPE html><html lang=\"es\"><head>
    <script type=\"module\">import { injectIntoGlobalHook } from \"/@react-refresh\";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;</script>·
    <script type=\"module\" src=\"/@vite/client\"></script>·
    <meta charset=\"UTF-8\">
    <link rel=\"icon\" type=\"image/png\" sizes=\"512x512\" href=\"/pwa/icon-512.png\">
    <link rel=\"icon\" type=\"image/png\" sizes=\"192x192\" href=\"/pwa/icon-192.png\">
    <link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"/pwa/apple-touch-icon.png\">
    <link rel=\"manifest\" href=\"/manifest.webmanifest\">
    <meta name=\"theme-color\" content=\"#6d28d9\">
    <meta name=\"apple-mobile-web-app-capable\" content=\"yes\">
    <meta name=\"apple-mobile-web-app-status-bar-style\" content=\"default\">
    <meta name=\"apple-mobile-web-app-title\" content=\"Stocky\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=5.0\">·····
    <!-- Compatibilidad con Brave y navegadores con privacidad mejorada -->
    <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">
    <meta name=\"referrer\" content=\"no-referrer-when-downgrade\">·····
    <!-- SEO Meta Tags -->
    <meta name=\"description\" content=\"Stocky - Sistema POS completo con gestión de inventario, ventas y comprobantes de pago\">
    <meta name=\"keywords\" content=\"POS, punto de venta, inventario, ventas, comprobantes\">·····
    <!-- Performance -->
    <link rel=\"preconnect\" href=\"https://wngjyrkqxblnhxliakqj.supabase.co\">
    <link rel=\"dns-prefetch\" href=\"https://wngjyrkqxblnhxliakqj.supabase.co\">·····
    <title>Stocky - Sistema POS</title>
  </head>
  <body>
    <div id=\"root\"></div>
    <script type=\"module\" src=\"/src/main.jsx\"></script>····
</body></html>"
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
  16 |     await expect(page.getByText(/Términos/i)).toBeVisible();
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
> 28 |     expect(content).toContain('soporte@stockypos.app');
     |                     ^ Error: expect(received).toContain(expected) // indexOf
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