import { useEffect, useState, useRef, useMemo, type ComponentType } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Resizable } from 're-resizable';
import { useGenerationStore } from '../../store/generationStore';
import { loadComponent } from '../../lib/componentRenderer';
import { ComponentErrorBoundary } from './ErrorBoundary';
import { ErrorOverlay } from './ErrorOverlay';
import type { Size } from '../../types/index';

interface CanvasItemProps {
  id: string;
  componentName: string;
  projectId: string;
  x: number;
  y: number;
  size?: Size;
  isSelected: boolean;
  onSelect: () => void;
  onResize: (width: number, height: number) => void;
  onFix: (errorMessage: string, errorStack?: string) => void;
  onConnectionsDetected: (source: string) => void;
  cmdKeyHeld: boolean;
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
  onResize,
  onFix,
  onConnectionsDetected,
  cmdKeyHeld,
}: CanvasItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `canvas-${id}`,
    data: { id, componentName, source: 'canvas' },
  });

  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [loading, setLoading] = useState(true);
  const [resizePreview, setResizePreview] = useState<Size | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);
  const { isGenerating, generationMode, editingComponentName, componentVersions, startEditing } = useGenerationStore();

  const componentVersion = componentVersions[componentName] || 0;
  const isBeingFixed = generationMode === 'fix' && editingComponentName === componentName && isGenerating;

  // Calculate display size
  const displaySize = useMemo(
    () => size || naturalSize || { width: 120, height: 40 },
    [size, naturalSize]
  );

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

  const activeSize = resizePreview || displaySize;
  const scale = naturalSize && naturalSize.width > 0
    ? activeSize.width / naturalSize.width
    : 1;

  const style = {
    position: 'absolute' as const,
    left: x,
    top: y,
    cursor: cmdKeyHeld ? (isDragging ? 'grabbing' : 'grab') : 'default',
  };

  return (
    <div
      id={`connection-anchor-${id}`}
      ref={setNodeRef}
      style={style}
      className={`group ${isDragging ? 'opacity-50 z-50' : ''}`}
      {...(cmdKeyHeld ? { ...listeners, ...attributes } : {})}
      onClick={(e) => {
        // Only handle Cmd+click - regular clicks pass through to component children
        if (e.metaKey || e.ctrlKey) {
          e.stopPropagation();
          e.preventDefault();
          onSelect();
          startEditing(componentName);
        }
      }}
    >
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
          topRight: false, bottomRight: cmdKeyHeld, bottomLeft: false, topLeft: false,
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
    </div>
  );
}
