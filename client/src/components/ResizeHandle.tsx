import React from 'react';

export type ResizeHandleDirection = 'horizontal' | 'vertical';

interface ResizeHandleProps {
  isResizing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  direction?: ResizeHandleDirection;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function ResizeHandle({
  isResizing,
  onMouseDown,
  direction = 'horizontal',
  position,
}: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal';
  const horizontalPosition = isHorizontal ? position || 'right' : undefined;
  const verticalPosition = !isHorizontal ? position || 'bottom' : undefined;

  const containerClasses = isHorizontal
    ? `absolute ${horizontalPosition === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 w-1 hover:w-1.5 bg-transparent hover:bg-neutral-400/50 cursor-col-resize transition-all duration-150 z-20 ${
        isResizing ? 'w-1.5 bg-neutral-500/50' : ''
      }`
    : `absolute ${verticalPosition === 'top' ? 'top-0' : 'bottom-0'} left-0 right-0 h-1 hover:h-1.5 bg-transparent hover:bg-neutral-400/50 cursor-row-resize transition-all duration-150 z-20 ${
        isResizing ? 'h-1.5 bg-neutral-500/50' : ''
      }`;

  return <div className={containerClasses} onMouseDown={onMouseDown} />;
}
