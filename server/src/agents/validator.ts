import { transform } from 'sucrase';

/**
 * List of all allowed scope keys - MUST match client's COMPONENT_SCOPE
 * This is the source of truth for what the generated components can use
 */
const ALLOWED_SCOPE_KEYS = [
  // React core
  'React', 'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo',

  // Shared state hook
  'useSharedState',

  // shadcn/ui components
  'Button', 'Card', 'CardContent', 'CardDescription', 'CardFooter', 'CardHeader', 'CardTitle',
  'Input', 'Label', 'Textarea', 'Checkbox',
  'Dialog', 'DialogContent', 'DialogDescription', 'DialogFooter', 'DialogHeader', 'DialogTitle', 'DialogTrigger',
  'Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue',
  'Tabs', 'TabsContent', 'TabsList', 'TabsTrigger',
  'Separator', 'Alert', 'AlertDescription', 'AlertTitle',
  'Avatar', 'AvatarFallback', 'AvatarImage', 'Badge',

  // Lucide icons (same as componentRenderer.ts)
  'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Check', 'CheckCircle',
  'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight',
  'Clock', 'Copy', 'Download', 'Edit', 'ExternalLink', 'Eye', 'EyeOff',
  'File', 'Filter', 'Heart', 'Home', 'Image', 'Info', 'Link', 'Loader2',
  'Lock', 'LogIn', 'LogOut', 'Mail', 'Menu', 'MessageCircle', 'Minus',
  'Moon', 'MoreHorizontal', 'MoreVertical', 'Phone', 'Plus', 'RefreshCw',
  'Search', 'Send', 'Settings', 'Share', 'ShoppingCart', 'Sparkles',
  'Star', 'Sun', 'Trash', 'Trash2', 'Upload', 'User', 'Users', 'X', 'Zap',
  'AlertCircle', 'AlertTriangle', 'Bell', 'Bookmark', 'Calendar', 'Camera',
  'CreditCard', 'Database', 'Folder', 'Gift', 'Globe', 'Grid', 'HelpCircle',
  'Inbox', 'Layers', 'Layout', 'List', 'MapPin', 'Maximize', 'Minimize',
  'Monitor', 'Package', 'Pause', 'Play', 'Power', 'Printer', 'Quote', 'Radio',
  'Save', 'Shield', 'Smartphone', 'Speaker', 'Tag', 'Target', 'Terminal',
  'ThumbsUp', 'ThumbsDown', 'TrendingUp', 'TrendingDown', 'Truck', 'Tv',
  'Type', 'Umbrella', 'Underline', 'Unlock', 'Video', 'Wifi', 'Wind',
  'Award', 'BarChart', 'Briefcase', 'Building', 'Code', 'Coffee', 'Compass',
  'Cpu', 'DollarSign', 'Feather', 'Flag', 'Headphones', 'Key', 'Lightbulb',
  'Mic', 'Music', 'PenTool', 'Percent', 'PieChart', 'Rocket', 'Scissors',
  'Server', 'Sliders', 'Smile', 'Snowflake', 'Timer', 'ToggleLeft', 'ToggleRight',
  'Trophy', 'Wrench',
  // Social icons
  'Github', 'Twitter', 'Linkedin', 'Facebook', 'Instagram', 'Youtube',

  // Layout primitives
  'Stack', 'Flex', 'LayoutGrid', 'Container',
];

/**
 * Create mock scope where each key is a stub function
 * We just need to verify the code executes without ReferenceError
 */
function createMockScope(): Record<string, unknown> {
  const scope: Record<string, unknown> = {};

  for (const key of ALLOWED_SCOPE_KEYS) {
    // React needs special handling
    if (key === 'React') {
      scope[key] = {
        createElement: () => null,
        Fragment: () => null,
      };
    } else if (key.startsWith('use')) {
      // Hooks return tuples or values
      if (key === 'useState') {
        scope[key] = (initial: unknown) => [initial, () => { }];
      } else if (key === 'useSharedState') {
        scope[key] = (key: string, initial: unknown) => [initial, () => { }];
      } else {
        scope[key] = () => ({});
      }
    } else {
      // Everything else is a component/icon - return a stub function
      scope[key] = () => null;
    }
  }

  return scope;
}

/**
 * Strip imports and exports from source code
 * Same logic as client's prepareSource
 */
function prepareSource(code: string): string {
  return code
    // Remove import statements (single and multi-line)
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
    // Convert "export default function X" to "function X"
    .replace(/export\s+default\s+function\s+/g, 'function ')
    // Convert "export default class X" to "class X"
    .replace(/export\s+default\s+class\s+/g, 'class ')
    // Remove standalone "export default X;" or "export default X"
    .replace(/^export\s+default\s+\w+\s*;?\s*$/gm, '')
    // Remove "export " from named exports
    .replace(/^export\s+(?=const|let|var|function|class)/gm, '')
    .trim();
}

/**
 * Extract the default export component name from code
 */
function extractDefaultExportName(code: string): string | null {
  // Match: export default function ComponentName
  const funcMatch = code.match(/export\s+default\s+function\s+(\w+)/);
  if (funcMatch) return funcMatch[1];

  // Match: export default ComponentName (at end or followed by statement)
  const directMatch = code.match(/export\s+default\s+(\w+)\s*(?:;|$)/m);
  if (directMatch) return directMatch[1];

  return null;
}

/**
 * Validate that component code compiles and executes without errors
 * Returns null on success, error message on failure
 */
export function validateComponent(code: string, componentName: string): string | null {
  try {
    // 1. Extract actual component name from code (or use provided)
    const exportName = extractDefaultExportName(code) || componentName;

    // 2. Strip imports/exports (same as client's prepareSource)
    const prepared = prepareSource(code);

    // 3. Compile JSX/TypeScript to JavaScript (same as client)
    const compiled = transform(prepared, {
      transforms: ['jsx', 'typescript'],
      jsxRuntime: 'classic',
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    }).code;

    // 4. Create mock scope and execute
    const mockScope = createMockScope();
    const scopeKeys = Object.keys(mockScope);
    const scopeValues = Object.values(mockScope);

    const fn = new Function(
      ...scopeKeys,
      `${compiled}; return typeof ${exportName} !== 'undefined' ? ${exportName} : null;`
    );

    const Component = fn(...scopeValues);

    if (!Component) {
      return `Component "${exportName}" not found in source. Make sure the component is properly exported.`;
    }

    // 5. Try to call the component (catches errors in the function body)
    // This catches issues like calling undefined functions
    try {
      Component({});
    } catch (renderError) {
      // Some errors during "render" are expected (e.g., hooks rules)
      // We only care about ReferenceErrors for undefined variables
      if (renderError instanceof ReferenceError) {
        return `Runtime error: ${renderError.message}`;
      }
      // Other errors (like hooks outside component) are OK at this stage
    }

    return null; // Success - no validation errors
  } catch (error) {
    // Compilation or execution failed
    const message = error instanceof Error ? error.message : 'Unknown compilation error';

    // Make error messages more helpful
    if (message.includes('is not defined')) {
      const match = message.match(/(\w+) is not defined/);
      if (match) {
        return `"${match[1]}" is not available. Check that it's in the allowed imports list and spelled correctly.`;
      }
    }

    return `Compilation error: ${message}`;
  }
}

/**
 * Get list of all allowed scope keys (for documentation/debugging)
 */
export function getAllowedScopeKeys(): string[] {
  return [...ALLOWED_SCOPE_KEYS];
}
