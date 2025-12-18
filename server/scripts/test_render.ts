#!/usr/bin/env npx tsx
/**
 * Test that generated components can be compiled/transformed
 * This validates syntax and export patterns match what the client expects
 */

import { transform } from 'sucrase';

const API_BASE = 'http://localhost:5001/api';

// Strip imports and convert exports (same as client componentRenderer)
function prepareSource(code: string): string {
  return code
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/export\s+default\s+function\s+/g, 'function ')
    .replace(/export\s+default\s+class\s+/g, 'class ')
    .replace(/^export\s+default\s+\w+\s*;?\s*$/gm, '')
    .replace(/^export\s+(?=const|let|var|function|class)/gm, '')
    .trim();
}

function extractDefaultExportName(code: string): string | null {
  const funcMatch = code.match(/export\s+default\s+function\s+(\w+)/);
  if (funcMatch) return funcMatch[1];
  const directMatch = code.match(/export\s+default\s+(\w+)\s*(?:;|$)/m);
  if (directMatch) return directMatch[1];
  return null;
}

async function testComponentCompilation(projectId: string, componentName: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch component source
    const res = await fetch(`${API_BASE}/projects/${projectId}/components/${componentName}`);
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const source = await res.text();

    // Check for default export
    const exportName = extractDefaultExportName(source);
    if (!exportName) {
      return { success: false, error: 'No default export found' };
    }

    // Prepare source (strip imports/exports)
    const prepared = prepareSource(source);

    // Try to transform with sucrase
    const compiled = transform(prepared, {
      transforms: ['jsx', 'typescript'],
      jsxRuntime: 'classic',
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    });

    // Basic syntax validation - try to parse the output
    // Note: We can't fully execute without React/dependencies, but we can check syntax
    new Function(compiled.code);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const projectId = process.argv[2];

  if (!projectId) {
    console.log('Usage: npx tsx test_render.ts <projectId> [componentName]');
    console.log('If componentName is omitted, tests all components in the project');
    process.exit(1);
  }

  const specificComponent = process.argv[3];

  console.log('\n============================================================');
  console.log('Component Compilation Test');
  console.log('============================================================');
  console.log(`Project: ${projectId}`);

  // Get list of components from canvas
  const canvasRes = await fetch(`${API_BASE}/projects/${projectId}/canvas`);
  if (!canvasRes.ok) {
    console.error(`Failed to fetch canvas: ${canvasRes.status}`);
    process.exit(1);
  }

  const canvasData = await canvasRes.json() as { status: string; components: Array<{ componentName: string }> };
  const componentNames = specificComponent
    ? [specificComponent]
    : canvasData.components.map((c) => c.componentName);

  console.log(`Testing ${componentNames.length} component(s)\n`);

  let passed = 0;
  let failed = 0;

  for (const name of componentNames) {
    const result = await testComponentCompilation(projectId, name);
    if (result.success) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}: ${result.error}`);
      failed++;
    }
  }

  console.log('\n============================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
