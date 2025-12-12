import { useEffect, useState, useRef, useMemo, type ComponentType } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Resizable } from 're-resizable';
import { useGenerationStore } from '../../store/generationStore';
import { loadComponent } from '../../lib/componentRenderer';
import { InteractionPanel } from '../InteractionPanel/index';
import { ComponentErrorBoundary } from './ErrorBoundary';
import { CanvasItemToolbar } from './CanvasItemToolbar';
import { ErrorOverlay } from './ErrorOverlay';
import type { Size, Interaction } from '../../types/index';

interface CanvasItemProps {
  id: string;
  componentName: string;
  projectId: string;
  x: number;
  y: number;
  size?: Size;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onResize: (width: number, height: number) => void;
  onFix: (errorMessage: string, errorStack?: string) => void;
  onConnectionsDetected: (source: string) => void;
  interactions?: Interaction[];
}

export function CanvasItem({
  id,
  componentName,
  projectId,
  x,
  y,
  size,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onResize,
  onFix,
  onConnectionsDetected,
  interactions,
}: CanvasItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas-${id}`,
    data: { id, componentName, source: 'canvas' },
  });

  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [loading, setLoading] = useState(true);
  const [resizePreview, setResizePreview] = useState<Size | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);
  const { isGenerating, generationMode, editingComponentName, componentVersions } = useGenerationStore();

  const componentVersion = componentVersions[componentName] || 0;
  const isBeingFixed = generationMode === 'fix' && editingComponentName === componentName && isGenerating;

  // Compute dynamic control positioning based on component location
  const controlPosition = useMemo(() => {
    const TOOLBAR_HEIGHT = 36;
    const EDGE_THRESHOLD = 50;
    const nearTop = y < TOOLBAR_HEIGHT + EDGE_THRESHOLD;
    const nearLeft = x < EDGE_THRESHOLD;
    const componentWidth = size?.width || 120;
    const canvasWidth = typeof window !== 'undefined' ? window.innerWidth - 350 : 1000;
    const nearRight = x + componentWidth > canvasWidth - EDGE_THRESHOLD;

    return {
      vertical: nearTop ? 'bottom' : 'top',
      horizontal: nearRight ? 'outsideLeft' : nearLeft ? 'outsideRight' : 'left',
    } as const;
  }, [x, y, size?.width]);

  // Store callback in ref to avoid re-triggering effect
  const connectionsCallbackRef = useRef(onConnectionsDetected);
  connectionsCallbackRef.current = onConnectionsDetected;

  // Load component when projectId, componentName, or version changes
  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    setComponentError(null);

    fetch(`/api/projects/${projectId}/components/${componentName}`, {
      signal: abortController.signal,
    })
      .then((res) => res.text())
      .then((source) => {
        if (abortController.signal.aborted) return;
        connectionsCallbackRef.current(source);
        return loadComponent(projectId, componentName);
      })
      .then((comp) => {
        if (abortController.signal.aborted || !comp) return;
        setComponent(() => comp);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Failed to load component:', err);
        setComponentError({ message: err.message, stack: err.stack });
        setLoading(false);
      });

    return () => abortController.abort();
  }, [projectId, componentName, componentVersion]);

  // Measure natural size ONCE when component first loads
  const hasInitialMeasurement = useRef(false);

  useEffect(() => {
    if (!Component || !componentRef.current || hasInitialMeasurement.current) return;

    const measureNaturalSize = () => {
      if (!componentRef.current) return;
      const rect = componentRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        hasInitialMeasurement.current = true;
        setNaturalSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };

    const timerId = setTimeout(measureNaturalSize, 100);
    return () => clearTimeout(timerId);
  }, [Component]);

  // Set initial box size only when there's no stored size
  useEffect(() => {
    if (naturalSize && !size) {
      onResize(naturalSize.width, naturalSize.height);
    }
  }, [naturalSize, size, onResize]);

  const handleFixErrors = () => {
    if (!componentError) return;
    onFix(componentError.message, componentError.stack);
  };

  const displaySize = useMemo(
    () => size || naturalSize || { width: 120, height: 40 },
    [size, naturalSize]
  );

  const activeSize = resizePreview || displaySize;
  const scale = naturalSize && naturalSize.width > 0
    ? activeSize.width / naturalSize.width
    : 1;

  const style = {
    position: 'absolute' as const,
    left: x,
    top: y,
    transform: transform && !isDragging ? CSS.Transform.toString(transform) : undefined,
  };

  return (
    <div
      id={`connection-anchor-${id}`}
      ref={setNodeRef}
      style={style}
      className={`group ${isDragging ? 'opacity-50 z-50' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <CanvasItemToolbar
        componentName={componentName}
        controlPosition={controlPosition}
        onEdit={onEdit}
        onDelete={onDelete}
        listeners={listeners}
        attributes={attributes}
      />

      <Resizable
        size={activeSize}
        onResize={(_e, _direction, _ref, d) => {
          setResizePreview({
            width: displaySize.width + d.width,
            height: displaySize.height + d.height,
          });
        }}
        onResizeStop={(_e, _direction, _ref, d) => {
          setResizePreview(null);
          const newWidth = displaySize.width + d.width;
          const newHeight = displaySize.height + d.height;
          onResize(newWidth, newHeight);
        }}
        minWidth={40}
        minHeight={24}
        lockAspectRatio={naturalSize ? naturalSize.width / naturalSize.height : true}
        className={`relative rounded transition-shadow duration-150 ${
          isSelected
            ? 'ring-2 ring-blue-500 ring-offset-1'
            : 'ring-0 group-hover:ring-1 group-hover:ring-neutral-300'
        }`}
        handleStyles={{
          bottomRight: { bottom: 0, right: 0, width: 12, height: 12, cursor: 'se-resize' },
        }}
        handleClasses={{
          bottomRight: 'opacity-0 group-hover:opacity-100 transition-opacity',
        }}
        handleComponent={{
          bottomRight: <div className="w-3 h-3 bg-blue-500 rounded-tl" />,
        }}
        enable={{
          top: false, right: false, bottom: false, left: false,
          topRight: false, bottomRight: true, bottomLeft: false, topLeft: false,
        }}
      >
        <div className={`w-full h-full flex items-center justify-center ${naturalSize ? 'overflow-hidden' : 'overflow-visible'}`}>
          {loading && <div className="text-xs text-neutral-400">Loading...</div>}
          {!loading && Component && (
            <ComponentErrorBoundary
              onError={(error) => setComponentError({ message: error.message, stack: error.stack })}
              resetKey={componentVersion}
            >
              <div
                ref={componentRef}
                className="inline-block"
                style={{
                  transformOrigin: 'center',
                  transform: scale !== 1 ? `scale(${scale})` : undefined,
                }}
              >
                <Component />
              </div>
            </ComponentErrorBoundary>
          )}
        </div>

        {componentError && (
          <ErrorOverlay
            message={componentError.message}
            isFixing={isBeingFixed}
            onFix={handleFixErrors}
          />
        )}
      </Resizable>

      {/* Interaction count badge */}
      {interactions && interactions.length > 0 && (
        <div
          className={`absolute px-1.5 py-0.5 bg-neutral-600 text-white text-[9px] rounded shadow-sm pointer-events-none z-20 ${
            controlPosition.vertical === 'bottom' ? '-top-5' : '-bottom-5'
          } ${
            controlPosition.horizontal === 'outsideLeft' ? 'right-0' :
            controlPosition.horizontal === 'outsideRight' ? 'left-0' : 'left-0'
          }`}
        >
          {interactions.length} interaction{interactions.length !== 1 ? 's' : ''}
        </div>
      )}

      {isSelected && (
        <InteractionPanel
          componentId={id}
          componentName={componentName}
          interactions={interactions}
        />
      )}
    </div>
  );
}
