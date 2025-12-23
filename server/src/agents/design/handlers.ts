import { projectService } from '../../services/projectService';

/**
 * Build canvas context string to inject into the user prompt
 */
export async function buildCanvasContext(projectId: string | null): Promise<string> {
  if (!projectId) {
    return 'CURRENT CANVAS: Empty (no project set)';
  }

  const canvas = await projectService.getCanvas(projectId);
  const allComponents = await projectService.listComponents(projectId);

  if (canvas.length === 0 && allComponents.length === 0) {
    return 'CURRENT CANVAS: Empty (no components yet)';
  }

  const onCanvas = canvas.map(c => {
    const pos = `(${c.position.x}, ${c.position.y})`;
    const size = c.size ? `, ${c.size.width}x${c.size.height}` : '';
    return `  - ${c.componentName} at ${pos}${size}`;
  }).join('\n');

  const canvasNames = new Set(canvas.map(c => c.componentName));
  const available = allComponents.filter(c => !canvasNames.has(c));

  let context = 'CURRENT CANVAS:';

  if (canvas.length > 0) {
    context += `\nComponents on canvas:\n${onCanvas}`;
  } else {
    context += '\nComponents on canvas: (none)';
  }

  if (available.length > 0) {
    context += `\n\nAvailable components (not placed): ${available.join(', ')}`;
  }

  return context;
}
