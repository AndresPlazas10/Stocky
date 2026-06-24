import { expect } from '@playwright/test';

/**
 * Signs in a user via the UI
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function signIn(page, email, password) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for the login form to be visible
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 10000 });

  await emailInput.fill(email);
  await page.locator('input[type="password"]').fill(password);

  // Click the login button
  const loginButton = page.locator('button[type="submit"]').first();
  await loginButton.click();

  // Wait for navigation after login
  await page.waitForURL(/\/(dashboard|mesas|home)/, { timeout: 15000 });
}

/**
 * Signs out the current user
 * @param {import('@playwright/test').Page} page
 */
export async function signOut(page) {
  // Try to find and click the user menu/logout button
  const logoutButton = page.locator('button:has-text("Cerrar sesion"), button:has-text("Salir"), [data-testid="logout"]');
  if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL(/\//, { timeout: 10000 });
  }
}

/**
 * Waits for the page to be fully loaded (no loading spinners)
 * @param {import('@playwright/test').Page} page
 */
export async function waitForPageReady(page) {
  // Wait for network idle
  await page.waitForLoadState('networkidle');

  // Wait for any loading spinners to disappear
  const loading = page.locator('.animate-spin, [aria-busy="true"]');
  const count = await loading.count();
  if (count > 0) {
    await loading.first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  }
}

/**
 * Fills a form field with clear
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {string} value
 */
export async function fillField(page, selector, value) {
  const field = page.locator(selector);
  await field.clear();
  await field.fill(value);
}

/**
 * Clicks a button and waits for action to complete
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
export async function clickAndWait(page, selector) {
  const button = page.locator(selector);
  await button.click();
  await page.waitForLoadState('networkidle');
}

/**
 * Checks that the user is on the expected page
 * @param {import('@playwright/test').Page} page
 * @param {string} path - Expected URL path
 */
export async function expectPagePath(page, path) {
  await expect(page).toHaveURL(new RegExp(path), { timeout: 10000 });
}

/**
 * Takes a screenshot with a descriptive name
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function takeScreenshot(page, name) {
  await page.screenshot({
    path: `testing/e2e/screenshots/${name}.png`,
    fullPage: true,
  });
}
