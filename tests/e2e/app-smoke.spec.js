const { test, expect } = require('@playwright/test');

test('Groovy boots without fatal browser errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(`${error.name}: ${error.message}`);
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle(/GroovyShelves/);
  await expect(page.locator('header.header')).toBeVisible();
  await expect(page.locator('.header-brand .logo')).toHaveAttribute('alt', 'Groovy');
  await expect(page.locator('#collection')).toBeAttached();
  await expect(page.locator('#addAlbumButton')).toBeAttached();

  await page.waitForLoadState('load');
  await page.waitForTimeout(500);

  expect(pageErrors, `Fatal browser errors:\n${pageErrors.join('\n')}`).toEqual([]);
});
