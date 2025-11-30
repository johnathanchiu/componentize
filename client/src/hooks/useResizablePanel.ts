import { useEffect, useRef, useState } from 'react';

export type ResizeDirection = 'horizontal' | 'vertical';
export type ResizeFrom = 'top' | 'bottom' | 'left' | 'right';

export interface UseResizablePanelOptions {
  storageKey: string;
  direction: ResizeDirection;
  defaultSize: number;
  minSize?: number;
  maxSize?: number;
  resizeFrom?: ResizeFrom;
}

export function useResizablePanel(options: UseResizablePanelOptions) {
  const {
    storageKey,
    direction,
    defaultSize,
    minSize = direction === 'horizontal' ? 200 : 150,
    maxSize = direction === 'horizontal'
      ? Math.max(600, window.innerWidth * 0.5)
      : window.innerHeight * 0.6,
    resizeFrom = direction === 'horizontal' ? 'right' : 'bottom',
  } = options;

  const [panelSize, setPanelSize] = useState(() => {
    const savedSize = localStorage.getItem(storageKey);
    return savedSize ? parseInt(savedSize) : defaultSize;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ size: number; position: number } | null>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, panelSize.toString());
  }, [panelSize, storageKey]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startPosition = direction === 'horizontal' ? e.clientX : e.clientY;
    resizeStartRef.current = {
      size: panelSize,
      position: startPosition,
    };
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const currentPosition = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPosition - resizeStartRef.current.position;

      let newSize: number;
      if (direction === 'horizontal') {
        if (resizeFrom === 'left') {
          newSize = resizeStartRef.current.size - delta;
        } else {
          newSize = resizeStartRef.current.size + delta;
        }
      } else {
        if (resizeFrom === 'bottom') {
          newSize = resizeStartRef.current.size - delta;
        } else {
          newSize = resizeStartRef.current.size + delta;
        }
      }

      const constrainedSize = Math.max(minSize, Math.min(maxSize, newSize));
      setPanelSize(constrainedSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, direction, minSize, maxSize, resizeFrom]);

  return {
    panelSize,
    isResizing,
    handleMouseDown,
    setPanelSize,
  };
}
