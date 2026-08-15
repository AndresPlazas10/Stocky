import { test } from '@playwright/test';
import { signIn, waitForPageReady } from './test-utils.js';

test('DIAG waiter modal', async ({ page }) => {
  await signIn(page, process.env.E2E_TEST_USERNAME, process.env.E2E_TEST_PASSWORD);
  await page.goto('/employee-dashboard');
  await waitForPageReady(page);
  const cards = page.locator('[data-testid="mesa-card"]');
  const n = await cards.count();
  console.log('W_CARDS=' + n);
  for (let i = 0; i < n; i++) {
    console.log('WCARD[' + i + ']=' + (await cards.nth(i).innerText()).replace(/\n/g, ' | ').slice(0, 120));
  }
  const occ = page.locator('[data-testid="mesa-card"]:has-text("Ocupada")').first();
  if (await occ.count()) {
    await occ.click();
    await page.waitForTimeout(4000);
    console.log('MODAL_QTY=' + await page.locator('[data-testid="qty-inc"]').count());
    console.log('MODAL_BODY=' + (await page.locator('body').innerText()).slice(0, 300).replace(/\n/g, ' | '));
  }
});
