import { useRef, useState, useEffect, useCallback } from 'react';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface UsePanZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  initialViewport?: Viewport;
}

export function usePanZoom(options: UsePanZoomOptions = {}) {
  const { minZoom = 0.25, maxZoom = 2, initialViewport = { x: 0, y: 0, zoom: 1 } } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Store viewport in ref (no re-renders during pan/zoom)
  const viewportRef = useRef<Viewport>(initialViewport);

  // State only for cursor UI
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  // For zoom display (throttled updates)
  const [displayZoom, setDisplayZoom] = useState(initialViewport.zoom);

  // Apply transform directly to DOM (no React re-renders)
  const applyTransform = useCallback(() => {
    if (!contentRef.current) return;
    const { x, y, zoom } = viewportRef.current;
    contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    let panStart: { x: number; y: number; vx: number; vy: number } | null = null;
    let spaceHeld = false;

    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        applyTransform();
        rafId = null;
      });
    };

    // Keyboard handlers
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceHeld = true;
        setIsSpaceHeld(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld = false;
        setIsSpaceHeld(false);
        panStart = null;
        setIsPanning(false);
      }
    };

    // Mouse handlers for pan
    const onMouseDown = (e: MouseEvent) => {
      if (spaceHeld || e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        panStart = {
          x: e.clientX,
          y: e.clientY,
          vx: viewportRef.current.x,
          vy: viewportRef.current.y,
        };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!panStart) return;

      viewportRef.current = {
        ...viewportRef.current,
        x: panStart.vx + (e.clientX - panStart.x),
        y: panStart.vy + (e.clientY - panStart.y),
      };
      scheduleUpdate();
    };

    const onMouseUp = () => {
      panStart = null;
      setIsPanning(false);
    };

    // Wheel handler for zoom
    const onWheel = (e: WheelEvent) => {
      if (!spaceHeld) return;

      e.preventDefault();
      e.stopPropagation();

      const v = viewportRef.current;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate new zoom
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(minZoom, Math.min(maxZoom, v.zoom * factor));

      // Zoom towards cursor
      const scale = newZoom / v.zoom;
      const newX = mouseX - (mouseX - v.x) * scale;
      const newY = mouseY - (mouseY - v.y) * scale;

      viewportRef.current = { x: newX, y: newY, zoom: newZoom };
      scheduleUpdate();
      setDisplayZoom(newZoom);
    };

    // Register all events
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Initial transform
    applyTransform();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
    };
  }, [applyTransform, minZoom, maxZoom]);

  // Get current viewport (for coordinate conversions)
  const getViewport = useCallback(() => viewportRef.current, []);

  return {
    containerRef,
    contentRef,
    isPanning,
    isSpaceHeld,
    displayZoom,
    getViewport,
  };
}
