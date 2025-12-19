import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/tmp/componentize-debug';
const PROJECT_ID = '1ef4922c-8305-4c5f-a86c-81ffb685e9ec';

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function saveFile(name: string, content: string) {
  const filePath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(filePath, content);
  console.log(`Saved: ${filePath}`);
}

async function debugNodeCSS() {
  await ensureDir(OUTPUT_DIR);
  console.log(`\n=== Node CSS Debug Script ===`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  try {
    // 1. Load app with project
    console.log('1. Loading app...');
    await page.goto(`http://localhost:5173/?project=${PROJECT_ID}`);
    await page.waitForSelector('[data-canvas="true"]', { timeout: 15000 });
    await page.waitForTimeout(3000); // Wait for components to render

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'canvas.png') });
    console.log('   Screenshot saved');

    // 2. Click on a node to select it
    console.log('2. Selecting first node...');
    const firstNode = await page.$('.react-flow__node-component');
    if (firstNode) {
      await firstNode.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'node-selected.png') });
    }

    // 3. Hover over a node
    console.log('3. Hovering over node...');
    if (firstNode) {
      await firstNode.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'node-hovered.png') });
    }

    // 4. Extract detailed DOM and CSS info for all nodes
    console.log('4. Extracting DOM/CSS data...');

    const nodeData = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node-component');
      const results: any[] = [];

      nodes.forEach((node, index) => {
        const htmlEl = node as HTMLElement;
        const computedStyle = window.getComputedStyle(htmlEl);

        // Get the node's HTML structure
        const nodeInfo: any = {
          index,
          className: htmlEl.className,
          outerHTML: htmlEl.outerHTML.substring(0, 2000), // Truncate for readability

          // React Flow node computed styles
          nodeStyles: {
            position: computedStyle.position,
            overflow: computedStyle.overflow,
            overflowX: computedStyle.overflowX,
            overflowY: computedStyle.overflowY,
            width: computedStyle.width,
            height: computedStyle.height,
            padding: computedStyle.padding,
            border: computedStyle.border,
            background: computedStyle.background,
            zIndex: computedStyle.zIndex,
            transform: computedStyle.transform,
            clip: computedStyle.clip,
            clipPath: computedStyle.clipPath,
          },

          // Children analysis
          children: [] as any[],
        };

        // Analyze first few children
        const children = htmlEl.children;
        for (let i = 0; i < Math.min(children.length, 5); i++) {
          const child = children[i] as HTMLElement;
          const childStyle = window.getComputedStyle(child);
          nodeInfo.children.push({
            tagName: child.tagName,
            className: child.className,
            childStyles: {
              position: childStyle.position,
              overflow: childStyle.overflow,
              overflowX: childStyle.overflowX,
              overflowY: childStyle.overflowY,
              width: childStyle.width,
              height: childStyle.height,
              inset: childStyle.inset,
              top: childStyle.top,
              left: childStyle.left,
              right: childStyle.right,
              bottom: childStyle.bottom,
            },
          });
        }

        // Look for the inner container with potential overflow
        const innerContainers = htmlEl.querySelectorAll('[style*="overflow"]');
        nodeInfo.elementsWithOverflow = [];
        innerContainers.forEach((el) => {
          const style = window.getComputedStyle(el as HTMLElement);
          nodeInfo.elementsWithOverflow.push({
            tagName: (el as HTMLElement).tagName,
            className: (el as HTMLElement).className,
            overflow: style.overflow,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
          });
        });

        // Find any elements with position absolute
        const absoluteEls = htmlEl.querySelectorAll('*');
        nodeInfo.absolutePositionedElements = [];
        absoluteEls.forEach((el) => {
          const style = window.getComputedStyle(el as HTMLElement);
          if (style.position === 'absolute') {
            const rect = (el as HTMLElement).getBoundingClientRect();
            const parentRect = htmlEl.getBoundingClientRect();
            nodeInfo.absolutePositionedElements.push({
              tagName: (el as HTMLElement).tagName,
              className: (el as HTMLElement).className,
              position: style.position,
              top: style.top,
              left: style.left,
              right: style.right,
              bottom: style.bottom,
              inset: style.inset,
              // Check if element extends outside parent
              extendsOutside: {
                top: rect.top < parentRect.top,
                left: rect.left < parentRect.left,
                right: rect.right > parentRect.right,
                bottom: rect.bottom > parentRect.bottom,
              },
              isVisible: rect.width > 0 && rect.height > 0,
            });
          }
        });

        results.push(nodeInfo);
      });

      return results;
    });

    await saveFile('node-css-data.json', JSON.stringify(nodeData, null, 2));
    console.log(`   Found ${nodeData.length} nodes`);

    // 5. Get full HTML of a single node for detailed inspection
    console.log('5. Extracting full node HTML...');
    const fullNodeHTML = await page.evaluate(() => {
      const node = document.querySelector('.react-flow__node-component');
      return node ? (node as HTMLElement).outerHTML : 'No node found';
    });
    await saveFile('single-node.html', fullNodeHTML);

    // 6. Check parent containers for overflow
    console.log('6. Checking parent container overflow...');
    const parentOverflow = await page.evaluate(() => {
      const node = document.querySelector('.react-flow__node-component');
      if (!node) return [];

      const parents: any[] = [];
      let el = node.parentElement;
      while (el && parents.length < 10) {
        const style = window.getComputedStyle(el);
        parents.push({
          tagName: el.tagName,
          className: el.className.substring(0, 100),
          overflow: style.overflow,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          position: style.position,
        });
        el = el.parentElement;
      }
      return parents;
    });
    await saveFile('parent-overflow.json', JSON.stringify(parentOverflow, null, 2));

    // 7. Look for the resize handle and selection border specifically
    console.log('7. Looking for resize handle and selection border...');
    const overlayInfo = await page.evaluate(() => {
      // Look for potential resize handles and selection borders
      const results: any = {
        resizeHandles: [],
        selectionBorders: [],
        hoverBorders: [],
      };

      // Look for elements with ring or border classes (selection indicators)
      document.querySelectorAll('[class*="ring-"], [class*="border-"]').forEach((el) => {
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);
        const rect = htmlEl.getBoundingClientRect();

        if (htmlEl.className.includes('ring-blue') || htmlEl.className.includes('ring-2')) {
          results.selectionBorders.push({
            className: htmlEl.className,
            visible: rect.width > 0 && rect.height > 0,
            dimensions: { width: rect.width, height: rect.height },
            position: style.position,
            inset: style.inset,
            pointerEvents: style.pointerEvents,
          });
        }

        if (htmlEl.className.includes('border-neutral')) {
          results.hoverBorders.push({
            className: htmlEl.className,
            visible: rect.width > 0 && rect.height > 0,
            dimensions: { width: rect.width, height: rect.height },
          });
        }
      });

      // Look for the custom resize handle (blue square)
      document.querySelectorAll('[style*="cursor: nwse-resize"], .nodrag.nopan').forEach((el) => {
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);
        const rect = htmlEl.getBoundingClientRect();
        results.resizeHandles.push({
          className: htmlEl.className,
          visible: rect.width > 0 && rect.height > 0,
          dimensions: { width: rect.width, height: rect.height },
          position: style.position,
          bottom: style.bottom,
          right: style.right,
          zIndex: style.zIndex,
          backgroundColor: style.backgroundColor,
        });
      });

      return results;
    });
    await saveFile('overlay-info.json', JSON.stringify(overlayInfo, null, 2));

    console.log(`\n=== Debug Complete ===`);
    console.log(`Files saved to: ${OUTPUT_DIR}`);
    const files = fs.readdirSync(OUTPUT_DIR);
    files.forEach(f => console.log(`  - ${f}`));

  } catch (error) {
    console.error('Debug failed:', error);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'error.png') });
  } finally {
    await browser.close();
  }
}

debugNodeCSS();
