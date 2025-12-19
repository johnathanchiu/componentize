/**
 * Component Complexity Analyzer
 *
 * Uses Babel to parse TSX components and analyze their complexity.
 * Determines if a component is too complex and should be decomposed.
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface ComplexityReport {
  isComplex: boolean;
  lineCount: number;
  jsxElementCount: number;
  buttonCount: number;
  cardSectionCount: number;
  listItemCount: number;
  topLevelChildCount: number;
  reasons: string[];
}

// Complexity thresholds
const THRESHOLDS = {
  maxLines: 25,
  maxButtons: 1,
  maxCardSections: 1,
  maxJsxElements: 12,
  maxTopLevelChildren: 2,
};

/**
 * Analyze the complexity of a React component
 */
export function analyzeComplexity(code: string, componentName: string): ComplexityReport {
  const lineCount = code.split('\n').length;
  let jsxElementCount = 0;
  let buttonCount = 0;
  let cardSectionCount = 0;
  let listItemCount = 0;
  let topLevelChildCount = 0;
  const reasons: string[] = [];

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    // Find the return statement and count elements
    traverse(ast, {
      JSXElement(path) {
        jsxElementCount++;

        const openingElement = path.node.openingElement;
        if (t.isJSXIdentifier(openingElement.name)) {
          const name = openingElement.name.name;

          if (name === 'Button') buttonCount++;
          if (['CardHeader', 'CardContent', 'CardFooter'].includes(name)) cardSectionCount++;
          if (name === 'li') listItemCount++;
        }
      },

      ReturnStatement(path) {
        const arg = path.node.argument;
        if (t.isJSXElement(arg)) {
          // Count direct children of root element
          const children = arg.children.filter(
            (child): child is t.JSXElement => t.isJSXElement(child)
          );
          topLevelChildCount = children.length;
        }
      },
    });
  } catch (err) {
    // If parsing fails, assume it's not complex (let other validation catch errors)
    return {
      isComplex: false,
      lineCount,
      jsxElementCount: 0,
      buttonCount: 0,
      cardSectionCount: 0,
      listItemCount: 0,
      topLevelChildCount: 0,
      reasons: [],
    };
  }

  // Determine if complex based on thresholds
  if (lineCount > THRESHOLDS.maxLines) {
    reasons.push(`${lineCount} lines (max ${THRESHOLDS.maxLines})`);
  }
  if (buttonCount > THRESHOLDS.maxButtons) {
    reasons.push(`${buttonCount} buttons (max ${THRESHOLDS.maxButtons})`);
  }
  if (cardSectionCount > THRESHOLDS.maxCardSections) {
    reasons.push(`${cardSectionCount} card sections (max ${THRESHOLDS.maxCardSections})`);
  }
  if (jsxElementCount > THRESHOLDS.maxJsxElements) {
    reasons.push(`${jsxElementCount} JSX elements (max ${THRESHOLDS.maxJsxElements})`);
  }
  if (topLevelChildCount > THRESHOLDS.maxTopLevelChildren) {
    reasons.push(`${topLevelChildCount} top-level children (max ${THRESHOLDS.maxTopLevelChildren})`);
  }

  const isComplex = reasons.length > 0;

  return {
    isComplex,
    lineCount,
    jsxElementCount,
    buttonCount,
    cardSectionCount,
    listItemCount,
    topLevelChildCount,
    reasons,
  };
}
