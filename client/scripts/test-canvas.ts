import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/tmp/componentize-debug';

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function screenshot(page: Page, name: string) {
  const filePath = path.join(OUTPUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath });
  console.log(`Screenshot: ${filePath}`);
}

async function saveJson(name: string, data: unknown) {
  const filePath = path.join(OUTPUT_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`JSON saved: ${filePath}`);
}

async function testCanvas(projectId: string) {
  await ensureDir(OUTPUT_DIR);
  console.log(`\nStarting Playwright test for project: ${projectId}`);
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  try {
    // 1. Load app
    console.log('1. Loading app...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(1000); // Wait for React to hydrate
    await screenshot(page, '01-home');

    // 2. Click on project (using data attribute)
    console.log(`2. Selecting project ${projectId}...`);
    const projectSelector = `[data-project-id="${projectId}"]`;

    // Check if project exists
    const projectElement = await page.$(projectSelector);
    if (!projectElement) {
      // Try clicking on any project card
      console.log('   Project not found by ID, looking for project cards...');
      const projectCards = await page.$$('.cursor-pointer');
      if (projectCards.length > 0) {
        await projectCards[0].click();
        console.log('   Clicked first available project');
      } else {
        throw new Error('No projects found');
      }
    } else {
      await projectElement.click();
    }

    await page.waitForSelector('[data-canvas="true"]', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for components to render
    await screenshot(page, '02-project-loaded');

    // 3. Export debug state
    console.log('3. Extracting debug state...');
    const debugState = await page.evaluate(() => {
      const debug = (window as any).__CANVAS_DEBUG__;
      if (!debug) return null;

      // Can't serialize functions, so just get data
      return {
        nodes: debug.nodes,
        edges: debug.edges,
        canvasComponents: debug.canvasComponents,
        currentProject: debug.currentProject,
      };
    });

    if (debugState) {
      await saveJson('canvas-state', debugState);
      console.log(`   Found ${debugState.nodes?.length || 0} nodes`);
      console.log(`   Found ${debugState.canvasComponents?.length || 0} canvas components`);
    } else {
      console.log('   Warning: __CANVAS_DEBUG__ not available');
    }

    // 4. Get canvas.json from API for comparison
    console.log('4. Fetching canvas data from API...');
    const apiCanvas = await page.evaluate(async (pid) => {
      const response = await fetch(`/api/projects/${pid}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.canvas;
    }, projectId);

    if (apiCanvas) {
      await saveJson('api-canvas', apiCanvas);
      console.log(`   API returned ${apiCanvas.length} components`);
    }

    // 5. Compare positions
    console.log('\n5. Position Analysis:');
    if (debugState?.canvasComponents && apiCanvas) {
      console.log('   Comparing canvas state vs API data...');
      for (const comp of debugState.canvasComponents) {
        const apiComp = apiCanvas.find((c: any) => c.componentName === comp.componentName);
        if (apiComp) {
          const xDiff = Math.abs(comp.position.x - apiComp.position.x);
          const yDiff = Math.abs(comp.position.y - apiComp.position.y);
          const status = xDiff < 1 && yDiff < 1 ? '✓' : '✗';
          console.log(`   ${status} ${comp.componentName}: canvas(${comp.position.x.toFixed(1)}, ${comp.position.y.toFixed(1)}) vs api(${apiComp.position.x.toFixed(1)}, ${apiComp.position.y.toFixed(1)})`);
        }
      }
    }

    // 6. Take final screenshot with any console errors
    await screenshot(page, '03-final');

    console.log(`\n✓ All debug files saved to: ${OUTPUT_DIR}`);
    console.log('Files:');
    const files = fs.readdirSync(OUTPUT_DIR);
    files.forEach(f => console.log(`  - ${f}`));

  } catch (error) {
    console.error('Test failed:', error);
    await screenshot(page, 'error-state');
  } finally {
    await browser.close();
  }
}

// Main
const projectId = process.argv[2];
if (!projectId) {
  console.log('Usage: npx tsx scripts/test-canvas.ts <projectId>');
  console.log('\nExample:');
  console.log('  npx tsx scripts/test-canvas.ts 4932fa77-b87d-4605-91de-87f5a7a187a9');
  console.log('\nMake sure the dev server is running first (npm run dev)');
  process.exit(1);
}

testCanvas(projectId);
