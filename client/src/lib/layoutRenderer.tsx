import React, { Fragment } from 'react';
import type { LayoutDefinition, LayoutChild, StackLayoutProps, FlexLayoutProps, GridLayoutProps, ContainerLayoutProps } from '../types';
import { Stack, Flex, Grid, Container } from './layoutPrimitives';

// ============================================================================
// Types
// ============================================================================

export type LoadedComponents = Map<string, React.ComponentType>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a layout child is a component reference (vs nested layout)
 */
export function isComponentRef(
  child: LayoutChild
): child is { component: string; props?: Record<string, unknown> } {
  return 'component' in child;
}

/**
 * Extract all component names from a layout definition (recursive)
 */
export function extractComponentNames(layout: LayoutDefinition): string[] {
  const names: string[] = [];

  function traverse(child: LayoutChild) {
    if (isComponentRef(child)) {
      names.push(child.component);
    } else {
      // It's a nested layout
      child.children.forEach(traverse);
    }
  }

  layout.children.forEach(traverse);
  return [...new Set(names)]; // Deduplicate
}

// ============================================================================
// Layout Renderer
// ============================================================================

interface RenderLayoutOptions {
  /** Map of component name -> loaded React component */
  loadedComponents: LoadedComponents;
  /** Optional wrapper for child components (e.g., for sortable) */
  childWrapper?: (
    child: React.ReactNode,
    key: string,
    index: number
  ) => React.ReactNode;
}

/**
 * Render children of a layout definition
 */
function renderChildren(
  layout: LayoutDefinition,
  options: RenderLayoutOptions
): React.ReactNode[] {
  const { loadedComponents, childWrapper } = options;

  return layout.children.map((child, index) => {
    let childElement: React.ReactNode;
    let childKey: string;

    if (isComponentRef(child)) {
      // It's a component reference
      childKey = child.component;
      const Component = loadedComponents.get(child.component);

      if (!Component) {
        childElement = (
          <div className="p-4 border border-dashed border-red-300 bg-red-50 rounded text-red-600 text-sm">
            Component not found: {child.component}
          </div>
        );
      } else {
        childElement = <Component {...(child.props || {})} />;
      }
    } else {
      // It's a nested layout
      childKey = child.name || `nested-${index}`;
      childElement = renderLayout(child, options);
    }

    // Apply wrapper if provided (for sortable, etc.)
    if (childWrapper) {
      return childWrapper(childElement, childKey, index);
    }

    return <Fragment key={childKey}>{childElement}</Fragment>;
  });
}

/**
 * Recursively render a layout definition into React elements.
 * Each layout type is rendered explicitly to ensure type safety.
 */
export function renderLayout(
  layout: LayoutDefinition,
  options: RenderLayoutOptions
): React.ReactNode {
  const children = renderChildren(layout, options);
  const props = layout.props || {};

  switch (layout.type) {
    case 'Stack':
      return <Stack {...(props as StackLayoutProps)}>{children}</Stack>;

    case 'Flex':
      return <Flex {...(props as FlexLayoutProps)}>{children}</Flex>;

    case 'Grid':
      return <Grid {...(props as GridLayoutProps)}>{children}</Grid>;

    case 'Container':
      return <Container {...(props as ContainerLayoutProps)}>{children}</Container>;

    default:
      console.error(`Unknown layout type: ${layout.type}`);
      return null;
  }
}

// ============================================================================
// React Component Wrapper
// ============================================================================

interface LayoutRendererProps {
  layout: LayoutDefinition;
  loadedComponents: LoadedComponents;
  childWrapper?: (
    child: React.ReactNode,
    key: string,
    index: number
  ) => React.ReactNode;
  className?: string;
}

/**
 * React component that renders a layout definition
 */
export const LayoutRenderer: React.FC<LayoutRendererProps> = ({
  layout,
  loadedComponents,
  childWrapper,
  className,
}) => {
  return (
    <div className={className}>
      {renderLayout(layout, { loadedComponents, childWrapper })}
    </div>
  );
};
