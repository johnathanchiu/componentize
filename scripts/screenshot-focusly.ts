import { chromium } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.join(__dirname, '../test-layouts/screenshots');

async function main() {
  console.log('Taking Focusly screenshot...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1800 },
  });

  try {
    const page = await context.newPage();

    console.log('Loading client app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Look for Focusly project
    console.log('Looking for Focusly Landing Page project...');

    const projectCard = await page.locator('text=Focusly Landing Page').first();
    if (await projectCard.isVisible()) {
      console.log('Found focusly-landing, clicking...');
      await projectCard.click();
      await page.waitForTimeout(5000); // Wait for canvas to fully load
    } else {
      console.log('Project not visible, scrolling...');
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(500);
      const projectCard2 = await page.locator('text=focusly-landing').first();
      if (await projectCard2.isVisible()) {
        await projectCard2.click();
        await page.waitForTimeout(5000);
      }
    }

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'focusly-landing.png'),
      fullPage: false
    });

    console.log('✅ Screenshot saved to:', path.join(SCREENSHOTS_DIR, 'focusly-landing.png'));
    await page.close();
  } catch (e) {
    console.log('❌ Failed:', e);
  }

  await browser.close();
}

main().catch(console.error);
