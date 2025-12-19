/**
 * Script to retroactively decompose complex components in a project
 *
 * Usage: npx tsx scripts/decompose-project.ts <projectId>
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { analyzeComplexity } from '../src/services/componentAnalyzer';
import { decomposeComponent } from '../src/services/componentDecomposer';

interface CanvasComponent {
  id: string;
  componentName: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

const projectId = process.argv[2] || '39519f5f-aa33-42a4-8ff7-4f409eaee700';
const projectDir = path.join(__dirname, '../.workspace/projects', projectId);

async function main() {
  console.log(`Decomposing components in project: ${projectId}`);
  console.log(`Project dir: ${projectDir}`);

  // Read canvas.json
  const canvasPath = path.join(projectDir, 'canvas.json');
  const canvas: CanvasComponent[] = JSON.parse(fs.readFileSync(canvasPath, 'utf-8'));

  // Get all component files
  const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.tsx'));
  console.log(`\nFound ${files.length} components: ${files.map(f => f.replace('.tsx', '')).join(', ')}`);

  const newCanvas: CanvasComponent[] = [];
  const componentsToDelete: string[] = [];

  for (const file of files) {
    const name = file.replace('.tsx', '');
    const filePath = path.join(projectDir, file);
    const code = fs.readFileSync(filePath, 'utf-8');

    // Find this component in canvas
    const canvasItem = canvas.find(c => c.componentName === name);
    if (!canvasItem) {
      console.log(`\n⚠️  ${name}: Not on canvas, skipping`);
      continue;
    }

    // Analyze complexity
    const complexity = analyzeComplexity(code, name);

    if (!complexity.isComplex) {
      console.log(`\n✓ ${name}: Simple (${complexity.lineCount} lines), keeping as-is`);
      newCanvas.push(canvasItem);
      continue;
    }

    console.log(`\n🔧 ${name}: Complex - ${complexity.reasons.join(', ')}`);

    // Try to decompose
    const decomposed = decomposeComponent(code, name, canvasItem.position);

    if (decomposed.length <= 1) {
      console.log(`   Could not decompose, keeping as-is`);
      newCanvas.push(canvasItem);
      continue;
    }

    console.log(`   Decomposed into ${decomposed.length} components:`);

    // Save each decomposed component
    for (const comp of decomposed) {
      const compPath = path.join(projectDir, `${comp.name}.tsx`);
      fs.writeFileSync(compPath, comp.code);
      console.log(`   - ${comp.name} at (${comp.position.x}, ${comp.position.y})`);

      // Add to new canvas
      newCanvas.push({
        id: uuidv4(),
        componentName: comp.name,
        position: comp.position,
        size: comp.size
      });
    }

    // Mark original for deletion
    componentsToDelete.push(name);
  }

  // Delete original complex components
  for (const name of componentsToDelete) {
    const filePath = path.join(projectDir, `${name}.tsx`);
    fs.unlinkSync(filePath);
    console.log(`\n🗑️  Deleted original: ${name}`);
  }

  // Save new canvas
  fs.writeFileSync(canvasPath, JSON.stringify(newCanvas, null, 2));
  console.log(`\n✅ Canvas updated with ${newCanvas.length} components`);
}

main().catch(console.error);
