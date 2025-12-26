/**
 * Screenshot Example Layouts
 *
 * Takes screenshots of all example layouts in test-layouts.
 *
 * Usage:
 *   npx tsx scripts/screenshot-layouts.ts
 *
 * Prerequisites:
 *   - test-layouts dev server running on http://localhost:5174
 *   - npm install playwright (already in devDeps)
 */

import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.join(__dirname, '../test-layouts/screenshots');
const BASE_URL = 'http://localhost:5174';

// All available layouts in test-layouts
const LAYOUTS = [
  { name: 'landing', description: 'SaaS Landing Page' },
  { name: 'dashboard', description: 'Analytics Dashboard' },
  { name: 'ecommerce', description: 'E-commerce Product Page' },
];

async function main() {
  console.log('Taking screenshots of example layouts...\n');

  // Ensure screenshots directory exists
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  for (const layout of LAYOUTS) {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 1200 },
    });

    try {
      const page = await context.newPage();
      const url = `${BASE_URL}?layout=${layout.name}`;

      console.log(`📸 ${layout.description} (${layout.name})...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000); // Let animations settle

      // Take viewport screenshot
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${layout.name}.png`),
        fullPage: false,
      });

      // Take full page screenshot
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${layout.name}-full.png`),
        fullPage: true,
      });

      console.log(`   ✅ Saved ${layout.name}.png and ${layout.name}-full.png`);
      await page.close();
    } catch (e) {
      console.log(`   ❌ Failed: ${e}`);
    }

    await context.close();
  }

  await browser.close();

  console.log(`\n📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
  console.log('\nFiles:');
  for (const layout of LAYOUTS) {
    console.log(`  - ${layout.name}.png (viewport)`);
    console.log(`  - ${layout.name}-full.png (full page)`);
  }
}

main().catch(console.error);
