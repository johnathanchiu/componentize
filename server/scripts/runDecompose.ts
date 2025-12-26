/**
 * Actually run decomposition on a project (not just test)
 * This will modify the project files
 */
import fs from 'fs/promises';
import path from 'path';
import { decomposeComponent } from '../src/services/componentDecomposer';
import { validateComponent } from '../src/agents/validator';

const WORKSPACE_DIR = path.join(__dirname, '../.workspace/projects');

async function runDecomposeProject(projectId: string) {
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

  for (const file of components) {
    const name = path.basename(file, '.tsx');
    const code = await fs.readFile(path.join(projectDir, file), 'utf-8');

    const pieces = decomposeComponent(code, name, { x: 0, y: 0 }, { width: 400, height: 300 });

    if (pieces.length <= 1) {
      console.log(`⏭️  ${name} - no decomposition needed`);
      continue;
    }

    // Validate all pieces
    let allValid = true;
    for (const piece of pieces) {
      const validation = validateComponent(piece.code, piece.name);
      if (validation) {
        console.log(`❌ ${name} - piece ${piece.name} failed: ${validation}`);
        allValid = false;
        break;
      }
    }

    if (!allValid) {
      console.log(`⏭️  ${name} - skipping due to validation errors`);
      continue;
    }

    // Delete original and write pieces
    await fs.unlink(path.join(projectDir, file));
    console.log(`🗑️  Deleted ${file}`);

    for (const piece of pieces) {
      const piecePath = path.join(projectDir, `${piece.name}.tsx`);
      await fs.writeFile(piecePath, piece.code);
      console.log(`✅ Created ${piece.name}.tsx`);
    }
  }

  console.log('\n✨ Done!\n');
}

const projectId = process.argv[2];
if (!projectId) {
  console.error('Usage: npx tsx scripts/runDecompose.ts <projectId>');
  process.exit(1);
}

runDecomposeProject(projectId);
