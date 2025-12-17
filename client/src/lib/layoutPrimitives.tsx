import React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Layout Primitive Types
// ============================================================================

export interface StackProps {
  direction?: 'vertical' | 'horizontal';
  gap?: number; // Tailwind gap units (4 = gap-4)
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  padding?: number;
  className?: string;
  children?: React.ReactNode;
}

export interface FlexProps {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  wrap?: boolean | 'reverse';
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  padding?: number;
  className?: string;
  children?: React.ReactNode;
}

export interface GridProps {
  columns?: number | string; // 3 or "repeat(auto-fit, minmax(300px, 1fr))"
  rows?: number | string;
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'stretch';
  padding?: number;
  className?: string;
  children?: React.ReactNode;
}

export interface ContainerProps {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  center?: boolean;
  padding?: number;
  className?: string;
  children?: React.ReactNode;
}

// ============================================================================
// Utility Maps
// ============================================================================

const alignMap = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
} as const;

const justifyMap = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
  stretch: 'justify-stretch',
} as const;

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
} as const;

// ============================================================================
// Stack Component
// ============================================================================

export const Stack: React.FC<StackProps> = ({
  direction = 'vertical',
  gap = 4,
  align = 'stretch',
  justify = 'start',
  padding,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'flex',
        direction === 'vertical' ? 'flex-col' : 'flex-row',
        alignMap[align],
        justifyMap[justify],
        `gap-${gap}`,
        padding !== undefined && `p-${padding}`,
        className
      )}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Flex Component
// ============================================================================

export const Flex: React.FC<FlexProps> = ({
  direction = 'row',
  wrap = false,
  gap = 4,
  align = 'stretch',
  justify = 'start',
  padding,
  className,
  children,
}) => {
  const wrapClass = wrap === true ? 'flex-wrap' : wrap === 'reverse' ? 'flex-wrap-reverse' : 'flex-nowrap';
  const directionClass = {
    row: 'flex-row',
    column: 'flex-col',
    'row-reverse': 'flex-row-reverse',
    'column-reverse': 'flex-col-reverse',
  }[direction];

  return (
    <div
      className={cn(
        'flex',
        directionClass,
        wrapClass,
        alignMap[align],
        justifyMap[justify as keyof typeof justifyMap],
        `gap-${gap}`,
        padding !== undefined && `p-${padding}`,
        className
      )}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Grid Component
// ============================================================================

export const Grid: React.FC<GridProps> = ({
  columns = 3,
  rows,
  gap = 4,
  align = 'stretch',
  justify = 'stretch',
  padding,
  className,
  children,
}) => {
  // Handle numeric columns (e.g., 3 -> "grid-cols-3")
  // Handle string columns for custom values (e.g., "repeat(auto-fit, minmax(300px, 1fr))")
  const colsClass = typeof columns === 'number' ? `grid-cols-${columns}` : undefined;
  const colsStyle = typeof columns === 'string' ? { gridTemplateColumns: columns } : undefined;

  const rowsClass = typeof rows === 'number' ? `grid-rows-${rows}` : undefined;
  const rowsStyle = typeof rows === 'string' ? { gridTemplateRows: rows } : undefined;

  return (
    <div
      className={cn(
        'grid',
        colsClass,
        rowsClass,
        `gap-${gap}`,
        align && `items-${align}`,
        justify && `justify-items-${justify}`,
        padding !== undefined && `p-${padding}`,
        className
      )}
      style={{ ...colsStyle, ...rowsStyle }}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Container Component
// ============================================================================

export const Container: React.FC<ContainerProps> = ({
  maxWidth = 'xl',
  center = true,
  padding = 4,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        maxWidthMap[maxWidth],
        center && 'mx-auto',
        padding !== undefined && `p-${padding}`,
        className
      )}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Export map for dynamic rendering
// ============================================================================

export const LAYOUT_PRIMITIVES = {
  Stack,
  Flex,
  Grid,
  Container,
} as const;

export type LayoutPrimitiveType = keyof typeof LAYOUT_PRIMITIVES;
