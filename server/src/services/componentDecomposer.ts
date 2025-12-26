/**
 * Component Decomposer
 *
 * Automatically splits complex React components into smaller atomic pieces.
 * Uses Babel to parse, transform, and regenerate component code.
 */

import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

export interface DecomposedComponent {
  name: string;
  code: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

// Size estimates for different element types
const SIZE_ESTIMATES: Record<string, { width: number; height: number }> = {
  Button: { width: 150, height: 50 },
  CardHeader: { width: 250, height: 100 },
  CardContent: { width: 250, height: 150 },
  CardFooter: { width: 250, height: 80 },
  ul: { width: 220, height: 180 },
  ol: { width: 220, height: 180 },
  div: { width: 200, height: 100 },
  p: { width: 200, height: 60 },
  h1: { width: 300, height: 60 },
  h2: { width: 280, height: 50 },
  h3: { width: 260, height: 45 },
  Badge: { width: 100, height: 30 },
  default: { width: 200, height: 100 },
};

// Spacing between decomposed components (used when no originalSize provided)
const VERTICAL_SPACING = 20;

// Small gap between pieces when fitting within original bounds
const INNER_GAP = 5;

/**
 * Decompose a complex component into smaller atomic pieces
 *
 * @param code - The component source code
 * @param originalName - The name of the original component
 * @param basePosition - The position of the original component on canvas
 * @param originalSize - Optional: the size of the original component.
 *                       If provided, pieces will be fit within this bounding box.
 */
export function decomposeComponent(
  code: string,
  originalName: string,
  basePosition: Position,
  originalSize?: Size
): DecomposedComponent[] {
  const components: DecomposedComponent[] = [];
  const collectedImports: t.ImportDeclaration[] = [];
  const collectedDeclarations: Map<string, t.VariableDeclaration> = new Map();

  let ast: t.File;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  } catch (err) {
    console.error('Failed to parse component:', err);
    return [];
  }

  // 1. Collect all imports
  traverse(ast, {
    ImportDeclaration(path) {
      collectedImports.push(t.cloneNode(path.node, true));
    },
  });

  // 2. Collect all variable declarations from the component function body
  traverse(ast, {
    FunctionDeclaration(path) {
      // Find the main component function
      path.traverse({
        VariableDeclaration(varPath) {
          // Only collect declarations at the function body level (not nested)
          if (varPath.parent === path.node.body) {
            for (const declarator of varPath.node.declarations) {
              // Handle simple identifier: const x = ...
              if (t.isIdentifier(declarator.id)) {
                collectedDeclarations.set(
                  declarator.id.name,
                  t.variableDeclaration(varPath.node.kind, [t.cloneNode(declarator, true)])
                );
              }
              // Handle array destructuring: const [x, setX] = useSharedState(...)
              else if (t.isArrayPattern(declarator.id)) {
                // Create the declaration ONCE and reuse for all identifiers
                const sharedDecl = t.variableDeclaration(varPath.node.kind, [t.cloneNode(declarator, true)]);
                for (const element of declarator.id.elements) {
                  if (t.isIdentifier(element)) {
                    // Store the same declaration object for each identifier in the pattern
                    collectedDeclarations.set(element.name, sharedDecl);
                  }
                }
              }
              // Handle object destructuring: const { x, y } = ...
              else if (t.isObjectPattern(declarator.id)) {
                // Create the declaration ONCE and reuse for all identifiers
                const sharedDecl = t.variableDeclaration(varPath.node.kind, [t.cloneNode(declarator, true)]);
                for (const prop of declarator.id.properties) {
                  if (t.isObjectProperty(prop) && t.isIdentifier(prop.value)) {
                    // Store the same declaration object for each identifier in the pattern
                    collectedDeclarations.set(prop.value.name, sharedDecl);
                  }
                }
              }
            }
          }
        },
      });
    },
  });

  // 3. Find the return statement and extract children
  traverse(ast, {
    ReturnStatement(path) {
      const arg = path.node.argument;
      if (!t.isJSXElement(arg)) return;

      // Get direct JSX children of the root element
      let children = arg.children.filter(
        (child): child is t.JSXElement => t.isJSXElement(child)
      );

      // Find the deepest level with multiple children (most granular decomposition)
      // This traverses through wrapper divs to find the actual content pieces
      const findDeepestChildren = (element: t.JSXElement, depth: number = 0): t.JSXElement[] => {
        if (depth > 5) return []; // Safety limit

        const directChildren = element.children.filter(
          (child): child is t.JSXElement => t.isJSXElement(child)
        );

        // If only 1 child that's a div, keep going deeper
        if (directChildren.length === 1 && getElementName(directChildren[0]) === 'div') {
          const deeper = findDeepestChildren(directChildren[0], depth + 1);
          // Only use deeper if it found multiple children
          if (deeper.length > 1) {
            return deeper;
          }
        }

        // If we have multiple children, check if any div child has MORE children
        // (prefer the most granular level)
        if (directChildren.length > 1) {
          for (const child of directChildren) {
            if (getElementName(child) === 'div') {
              const deeper = findDeepestChildren(child, depth + 1);
              if (deeper.length > directChildren.length) {
                return deeper;
              }
            }
          }
        }

        return directChildren;
      };

      children = findDeepestChildren(arg);

      // If only 1 or 0 children, don't decompose
      if (children.length <= 1) {
        return;
      }

      // First pass: estimate sizes for all children
      const childData = children.map((child, index) => {
        const elementName = getElementName(child);
        const componentName = generateComponentName(originalName, elementName, index, children.length);
        const usedIdentifiers = collectUsedIdentifiers(child);
        const neededImports = filterImportsForIdentifiers(collectedImports, usedIdentifiers);
        const neededDeclarations = filterDeclarationsForIdentifiers(collectedDeclarations, usedIdentifiers);
        const componentCode = buildComponentCode(componentName, child, neededImports, neededDeclarations);
        const estimatedSize = estimateSize(child);

        return { child, componentName, componentCode, estimatedSize };
      });

      // Calculate positions - either within original bounds or stacking vertically
      if (originalSize) {
        // Fit within original bounding box
        const totalGaps = (children.length - 1) * INNER_GAP;
        const availableHeight = originalSize.height - totalGaps;
        const totalEstimatedHeight = childData.reduce((sum, c) => sum + c.estimatedSize.height, 0);

        // Scale factor to fit everything in the available height
        const scale = Math.min(1, availableHeight / totalEstimatedHeight);

        let currentY = basePosition.y;

        childData.forEach((data) => {
          const scaledHeight = Math.round(data.estimatedSize.height * scale);

          components.push({
            name: data.componentName,
            code: data.componentCode,
            position: { x: basePosition.x, y: currentY },
            size: { width: originalSize.width, height: scaledHeight }
          });

          currentY += scaledHeight + INNER_GAP;
        });
      } else {
        // No original size - stack vertically with spacing
        let currentY = basePosition.y;

        childData.forEach((data) => {
          components.push({
            name: data.componentName,
            code: data.componentCode,
            position: { x: basePosition.x, y: currentY },
            size: data.estimatedSize
          });

          currentY += data.estimatedSize.height + VERTICAL_SPACING;
        });
      }
    },
  });

  return components;
}

/**
 * Get the element name from a JSX element
 */
function getElementName(node: t.JSXElement): string {
  const opening = node.openingElement;
  if (t.isJSXIdentifier(opening.name)) {
    return opening.name.name;
  }
  if (t.isJSXMemberExpression(opening.name)) {
    // Handle things like Card.Header
    return t.isJSXIdentifier(opening.name.property)
      ? opening.name.property.name
      : 'Section';
  }
  return 'Section';
}

/**
 * Generate a unique component name
 */
function generateComponentName(
  originalName: string,
  elementName: string,
  index: number,
  totalCount: number
): string {
  // For common patterns, use descriptive names
  const nameMap: Record<string, string> = {
    CardHeader: 'Header',
    CardContent: 'Content',
    CardFooter: 'Footer',
    Button: 'Button',
    ul: 'List',
    ol: 'List',
    div: 'Section',
    p: 'Text',
    h1: 'Title',
    h2: 'Subtitle',
    h3: 'Heading',
  };

  const suffix = nameMap[elementName] || elementName;

  // If there are multiple of the same type, add index
  if (totalCount > 1 && ['div', 'Section', 'Button'].includes(suffix)) {
    return `${originalName}${suffix}${index + 1}`;
  }

  return `${originalName}${suffix}`;
}

/**
 * Collect all identifiers used in a JSX tree
 */
function collectUsedIdentifiers(node: t.JSXElement): Set<string> {
  const identifiers = new Set<string>();

  // Simple recursive traversal to find all identifiers
  const visit = (n: t.Node) => {
    if (t.isJSXIdentifier(n)) {
      // Only add capitalized identifiers (components, not HTML elements)
      if (n.name[0] === n.name[0].toUpperCase()) {
        identifiers.add(n.name);
      }
    }
    if (t.isIdentifier(n)) {
      identifiers.add(n.name);
    }

    // Recursively visit children - use Object.entries for type-safe iteration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeRecord = n as Record<string, any>;
    for (const key of Object.keys(nodeRecord)) {
      const child = nodeRecord[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          child.forEach((c: unknown) => {
            if (c && typeof c === 'object' && 'type' in c && t.isNode(c as t.Node)) {
              visit(c as t.Node);
            }
          });
        } else if ('type' in child && t.isNode(child as t.Node)) {
          visit(child as t.Node);
        }
      }
    }
  };

  visit(node);
  return identifiers;
}

/**
 * Filter imports to only those needed for the given identifiers
 */
function filterImportsForIdentifiers(
  imports: t.ImportDeclaration[],
  usedIdentifiers: Set<string>
): t.ImportDeclaration[] {
  const filtered: t.ImportDeclaration[] = [];

  for (const imp of imports) {
    const neededSpecifiers = imp.specifiers.filter((spec) => {
      if (t.isImportDefaultSpecifier(spec)) {
        return usedIdentifiers.has(spec.local.name);
      }
      if (t.isImportSpecifier(spec)) {
        return usedIdentifiers.has(spec.local.name);
      }
      if (t.isImportNamespaceSpecifier(spec)) {
        return usedIdentifiers.has(spec.local.name);
      }
      return false;
    });

    if (neededSpecifiers.length > 0) {
      filtered.push(
        t.importDeclaration(neededSpecifiers, t.cloneNode(imp.source))
      );
    }
  }

  return filtered;
}

/**
 * Collect all identifiers used in a variable declaration's initializer
 */
function collectIdentifiersInDeclaration(decl: t.VariableDeclaration): Set<string> {
  const identifiers = new Set<string>();

  for (const declarator of decl.declarations) {
    if (declarator.init) {
      // Simple recursive traversal of the initializer
      const visit = (n: t.Node) => {
        if (t.isIdentifier(n)) {
          identifiers.add(n.name);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodeRecord = n as Record<string, any>;
        for (const key of Object.keys(nodeRecord)) {
          const child = nodeRecord[key];
          if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
              child.forEach((c: unknown) => {
                if (c && typeof c === 'object' && 'type' in c && t.isNode(c as t.Node)) {
                  visit(c as t.Node);
                }
              });
            } else if ('type' in child && t.isNode(child as t.Node)) {
              visit(child as t.Node);
            }
          }
        }
      };
      visit(declarator.init);
    }
  }

  return identifiers;
}

/**
 * Filter variable declarations to only those needed for the given identifiers.
 * Transitively resolves dependencies (if `a` depends on `b`, includes both).
 * Tracks declarations by reference to avoid duplicates from destructuring
 * (e.g., const [a, b] = ... stored under both 'a' and 'b').
 */
function filterDeclarationsForIdentifiers(
  declarations: Map<string, t.VariableDeclaration>,
  usedIdentifiers: Set<string>
): t.VariableDeclaration[] {
  const filtered: t.VariableDeclaration[] = [];
  const addedNames = new Set<string>();
  const addedDecls = new Set<t.VariableDeclaration>(); // Track by reference

  // Recursively add a declaration and its dependencies
  const addDeclaration = (name: string) => {
    if (addedNames.has(name)) return;

    const decl = declarations.get(name);
    if (!decl) return;

    // First, add any declarations this one depends on
    const depsInDecl = collectIdentifiersInDeclaration(decl);
    for (const depName of depsInDecl) {
      if (declarations.has(depName) && !addedNames.has(depName)) {
        addDeclaration(depName);
      }
    }

    // Mark this name as processed
    addedNames.add(name);

    // Only add the declaration if we haven't already added this exact object
    // (handles destructuring where same decl is stored under multiple names)
    if (!addedDecls.has(decl)) {
      addedDecls.add(decl);
      filtered.push(t.cloneNode(decl, true));
    }
  };

  // Process all directly used identifiers
  for (const name of usedIdentifiers) {
    if (declarations.has(name)) {
      addDeclaration(name);
    }
  }

  return filtered;
}

/**
 * Build complete component code from JSX element
 */
function buildComponentCode(
  name: string,
  jsxElement: t.JSXElement,
  imports: t.ImportDeclaration[],
  declarations: t.VariableDeclaration[] = []
): string {
  // Wrap the JSX in a centered container for canvas compatibility
  // Using flex + items-center + justify-center to maintain centering from parent
  const wrappedJsx = t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('div'),
      [
        t.jsxAttribute(
          t.jsxIdentifier('className'),
          t.stringLiteral('w-full h-full flex items-center justify-center')
        ),
      ]
    ),
    t.jsxClosingElement(t.jsxIdentifier('div')),
    [t.cloneNode(jsxElement, true)]
  );

  // Build the function body with declarations + return
  const functionBody: t.Statement[] = [
    ...declarations,
    t.returnStatement(t.parenthesizedExpression(wrappedJsx)),
  ];

  // Build the function component
  const functionDecl = t.functionDeclaration(
    t.identifier(name),
    [],
    t.blockStatement(functionBody)
  );

  // Add export default
  const exportDecl = t.exportDefaultDeclaration(functionDecl);

  // Build the full program
  const program = t.program([...imports, exportDecl]);
  const file = t.file(program);

  // Generate code
  const { code } = generate(file, {
    retainLines: false,
    compact: false,
  });

  return code;
}

/**
 * Estimate the size of a component based on its content
 */
function estimateSize(node: t.JSXElement): { width: number; height: number } {
  const elementName = getElementName(node);

  // Check for known element types
  if (SIZE_ESTIMATES[elementName]) {
    return { ...SIZE_ESTIMATES[elementName] };
  }

  // For unknown elements, estimate based on children count
  const childCount = node.children.filter((c) => t.isJSXElement(c)).length;
  const baseSize = SIZE_ESTIMATES.default;

  return {
    width: baseSize.width,
    height: Math.max(baseSize.height, baseSize.height + childCount * 30),
  };
}
