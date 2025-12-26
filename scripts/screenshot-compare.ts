import { chromium } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.join(__dirname, '../test-layouts/screenshots');

async function main() {
  console.log('Starting screenshot comparison...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1600 },
  });

  // Screenshot 1: test-layouts direct render (port 5174)
  try {
    const testLayoutsPage = await context.newPage();
    console.log('Loading test-layouts app...');
    await testLayoutsPage.goto('http://localhost:5174', { waitUntil: 'networkidle', timeout: 15000 });
    await testLayoutsPage.waitForTimeout(2000);

    await testLayoutsPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'test-layouts-fresh.png'),
      fullPage: false
    });
    console.log('✅ test-layouts screenshot saved');
    await testLayoutsPage.close();
  } catch (e) {
    console.log('❌ Failed to screenshot test-layouts (is it running on port 5174?):', e);
  }

  // Screenshot 2: ReactFlow canvas with test-landing-page project
  // Client runs on port 5173
  try {
    const canvasPage = await context.newPage();

    // Navigate to main app - will need to select project
    console.log('Loading client app...');
    await canvasPage.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    await canvasPage.waitForTimeout(2000);

    // Look for "Test Landing Page" project in the list (matches project.json name)
    console.log('Looking for Test Landing Page project...');

    // Scroll down to see more projects
    await canvasPage.mouse.wheel(0, 500);
    await canvasPage.waitForTimeout(500);

    // Click on the project
    const projectCard = await canvasPage.locator('text=Test Landing Page').first();
    if (await projectCard.isVisible()) {
      console.log('Found Test Landing Page, clicking...');
      await projectCard.click();
      await canvasPage.waitForTimeout(4000); // Wait for canvas to fully load
    } else {
      console.log('Project not found, trying Full Landing Page Test...');
      const altProject = await canvasPage.locator('text=Full Landing Page Test').first();
      if (await altProject.isVisible()) {
        await altProject.click();
        await canvasPage.waitForTimeout(4000);
      }
    }

    // Wait for canvas to load
    await canvasPage.waitForTimeout(3000);

    // Find the ReactFlow canvas
    const reactFlowViewport = await canvasPage.locator('.react-flow__viewport').first();
    if (await reactFlowViewport.isVisible()) {
      console.log('ReactFlow canvas found');
    }

    // Take full viewport screenshot
    await canvasPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'reactflow-canvas.png'),
      fullPage: false
    });

    // Also try to take a screenshot of just the artboard/canvas area
    const canvasArea = await canvasPage.locator('[data-canvas="true"]').first();
    if (await canvasArea.isVisible()) {
      await canvasArea.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'reactflow-canvas-only.png'),
      });
      console.log('Canvas-only screenshot saved');
    }
    console.log('✅ ReactFlow canvas screenshot saved');
    await canvasPage.close();
  } catch (e) {
    console.log('❌ Failed to screenshot ReactFlow canvas:', e);
  }

  await browser.close();
  console.log('\nScreenshots saved to:', SCREENSHOTS_DIR);
  console.log('\nCompare:');
  console.log('  - Original: test-layouts/screenshots/landing-page.png');
  console.log('  - ReactFlow: test-layouts/screenshots/reactflow-canvas.png');
}

main().catch(console.error);
