/**
 * Record Demo Video
 *
 * Records a video of the AI agent building a landing page.
 * Uses Playwright's built-in video recording.
 *
 * Usage:
 *   npx tsx scripts/record-demo.ts [prompt]
 *
 * Examples:
 *   npx tsx scripts/record-demo.ts
 *   npx tsx scripts/record-demo.ts "Build a dashboard with stats"
 *
 * Prerequisites:
 *   - Server running on http://localhost:5001
 *   - Client running on http://localhost:5173
 */

import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const VIDEOS_DIR = path.join(__dirname, '../demo-videos');

const DEFAULT_PROMPT = 'Build a complete SaaS landing page with dark theme: navbar with logo and signup button, hero section with headline and CTA, 3 feature cards in a row, pricing section with 3 tiers, and footer.';

async function recordDemo(prompt: string) {
  console.log('🎬 Starting demo recording...\n');
  console.log(`Prompt: "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"\n`);

  // Ensure videos directory exists
  if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false, // Show browser window
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: VIDEOS_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  try {
    // Navigate to app
    console.log('📍 Navigating to app...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Type the prompt with typing effect
    console.log('⌨️  Typing prompt...');
    const textarea = page.locator('textarea');
    await textarea.click();

    // Type with realistic speed
    for (const char of prompt) {
      await textarea.type(char, { delay: 25 });
    }
    await page.waitForTimeout(800);

    // Submit
    console.log('🚀 Submitting...');
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to project
    await page.waitForURL(/\/project\//, { timeout: 10000 });
    console.log('📦 Project created, waiting for generation...');

    // Wait for generation to complete
    const maxWait = 180; // 3 minutes max
    let elapsed = 0;

    while (elapsed < maxWait) {
      await page.waitForTimeout(2000);
      elapsed += 2;

      // Check for completion indicators
      const components = await page.$$('[data-component-node]');
      if (components.length >= 5) {
        console.log(`✅ Generation complete (${components.length} components, ${elapsed}s)`);
        break;
      }

      if (elapsed % 20 === 0) {
        console.log(`⏳ Still generating... (${elapsed}s)`);
      }
    }

    // Let the final result settle
    await page.waitForTimeout(3000);

    // Take a final screenshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({
      path: path.join(VIDEOS_DIR, `demo-${timestamp}.png`),
      fullPage: true,
    });
    console.log('📸 Screenshot saved');

  } catch (error) {
    console.error('❌ Error during recording:', error);
  } finally {
    // Close to save video
    await context.close();
    await browser.close();
  }

  console.log(`\n✅ Recording complete!`);
  console.log(`📁 Files saved to: ${VIDEOS_DIR}`);
}

// Get prompt from CLI args or use default
const customPrompt = process.argv[2];
const prompt = customPrompt || DEFAULT_PROMPT;

recordDemo(prompt).catch(console.error);
