/**
 * Test script to run decomposer on all components in a project
 * Usage: npx tsx scripts/testDecompose.ts <projectId>
 */

import fs from 'fs/promises';
import path from 'path';
import { decomposeComponent } from '../src/services/componentDecomposer';
import { validateComponent } from '../src/agents/validator';

const WORKSPACE_DIR = path.join(__dirname, '../.workspace/projects');

async function testDecomposeProject(projectId: string) {
  const projectDir = path.join(WORKSPACE_DIR, projectId);

  try {
    await fs.access(projectDir);
  } catch {
    console.error(`Project not found: ${projectId}`);
    process.exit(1);
  }

  const files = await fs.readdir(projectDir);
  const components = files.filter(f => f.endsWith('.tsx'));

  console.log(`\n📁 Project: ${projectId}`);
  console.log(`📦 Found ${components.length} components\n`);
  console.log('='.repeat(60));

  for (const file of components) {
    const name = path.basename(file, '.tsx');
    const code = await fs.readFile(path.join(projectDir, file), 'utf-8');

    console.log(`\n🔍 ${name}`);
    console.log('-'.repeat(40));

    // Count direct children in the JSX
    const returnMatch = code.match(/return\s*\(\s*<(\w+)/);
    const rootElement = returnMatch?.[1] || 'unknown';
    console.log(`   Root element: <${rootElement}>`);

    // Try decomposing
    const pieces = decomposeComponent(code, name, { x: 0, y: 0 }, { width: 400, height: 300 });

    if (pieces.length === 0) {
      console.log(`   ❌ No decomposition (<=1 direct child)`);
    } else if (pieces.length === 1) {
      console.log(`   ⚠️  Only 1 piece extracted`);
    } else {
      console.log(`   ✅ Decomposed into ${pieces.length} pieces:`);

      for (const piece of pieces) {
        const validation = validateComponent(piece.code, piece.name);
        const status = validation ? '❌ INVALID' : '✅ valid';
        console.log(`      - ${piece.name} (${piece.size.width}x${piece.size.height}) ${status}`);

        if (validation) {
          console.log(`        Error: ${validation}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done!\n');
}

// Get project ID from command line
const projectId = process.argv[2];
if (!projectId) {
  console.error('Usage: npx tsx scripts/testDecompose.ts <projectId>');
  process.exit(1);
}

testDecomposeProject(projectId);
