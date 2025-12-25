import { test } from '@playwright/test';

test('capture hero section screenshot', async ({ page }) => {
  await page.goto('/');

  // Wait for content to load
  await page.waitForTimeout(1000);

  // Full page screenshot
  await page.screenshot({
    path: 'screenshots/hero-section.png',
    fullPage: true,
  });

  console.log('Screenshot saved to screenshots/hero-section.png');
});
