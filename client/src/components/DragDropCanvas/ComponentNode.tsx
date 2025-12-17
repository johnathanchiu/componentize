import { useEffect, useState, useRef, type ComponentType, memo } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { useGenerationStore } from '../../store/generationStore';
import { useCmdKey } from '../../hooks/useCmdKey';
import { loadComponent } from '../../lib/componentRenderer';
import { ComponentErrorBoundary } from './ErrorBoundary';
import { ErrorOverlay } from './ErrorOverlay';
import type { Size } from '../../types/index';

export interface ComponentNodeData extends Record<string, unknown> {
  componentName: string;
  projectId: string;
  naturalSize?: Size;
  onFix?: (errorMessage: string, errorStack?: string) => void;
  onConnectionsDetected?: (source: string) => void;
  onNaturalSizeChange?: (size: Size) => void;
}

function ComponentNodeInner({ data, selected }: NodeProps & { data: ComponentNodeData }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(data.naturalSize || null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const componentRef = useRef<HTMLDivElement>(null);

  const { isGenerating, generationMode, editingComponentName, componentVersions, startEditing } = useGenerationStore();

  // Track Cmd/Ctrl key state for pointer events
  // When Cmd is held, pointer events pass through to React Flow for drag/select
  const cmdKeyHeld = useCmdKey();

  const componentVersion = componentVersions[data.componentName] || 0;
  const isBeingFixed = generationMode === 'fix' && editingComponentName === data.componentName && isGenerating;

  // Store callback in ref to avoid re-triggering effect
  const connectionsCallbackRef = useRef(data.onConnectionsDetected);
  connectionsCallbackRef.current = data.onConnectionsDetected;

  // Load component when projectId, componentName, or version changes
  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    setComponentError(null);

    fetch(`/api/projects/${data.projectId}/components/${data.componentName}`, {
      signal: abortController.signal,
    })
      .then((res) => res.text())
      .then((source) => {
        if (abortController.signal.aborted) return;
        connectionsCallbackRef.current?.(source);
        return loadComponent(data.projectId, data.componentName);
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
  }, [data.projectId, data.componentName, componentVersion]);

  // Measure natural size ONCE when component first loads
  const hasInitialMeasurement = useRef(false);

  useEffect(() => {
    if (!Component || !componentRef.current || hasInitialMeasurement.current) return;

    const measureNaturalSize = () => {
      if (!componentRef.current) return;
      const rect = componentRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        hasInitialMeasurement.current = true;
        const size = { width: Math.round(rect.width), height: Math.round(rect.height) };
        setNaturalSize(size);
        data.onNaturalSizeChange?.(size);
      }
    };

    const timerId = setTimeout(measureNaturalSize, 100);
    return () => clearTimeout(timerId);
  }, [Component, data]);

  const handleFixErrors = () => {
    if (!componentError || !data.onFix) return;
    data.onFix(componentError.message, componentError.stack);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Cmd/Ctrl+click to start editing
    if (e.metaKey || e.ctrlKey) {
      e.stopPropagation();
      startEditing(data.componentName);
    }
  };

  // Calculate aspect ratio for resize constraints
  const aspectRatio = naturalSize ? naturalSize.width / naturalSize.height : undefined;

  const showHandles = selected || isHovered;

  return (
    <div
      className={`relative inline-block ${cmdKeyHeld ? 'cursor-move' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Selection outline - only when selected */}
      {selected && (
        <div className="absolute inset-[-4px] border-2 border-blue-500 rounded-lg pointer-events-none" />
      )}

      {/* Resize handle - only shown when selected */}
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={24}
        keepAspectRatio={!!aspectRatio}
      />

      {/* Connection handles - only visible on hover or selection */}
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-2 !h-2 !bg-blue-400 !border-white !border-2 transition-opacity ${
          showHandles ? '!opacity-100' : '!opacity-0'
        }`}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-2 !h-2 !bg-blue-400 !border-white !border-2 transition-opacity ${
          showHandles ? '!opacity-100' : '!opacity-0'
        }`}
      />

      {/* Component content - transparent background */}
      {loading && (
        <div className="flex items-center justify-center p-4 text-xs text-neutral-400">
          Loading...
        </div>
      )}
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
              // When Cmd is held, disable pointer events so clicks go to React Flow for selection/dragging
              pointerEvents: cmdKeyHeld ? 'none' : 'auto',
            }}
          >
            <Component />
          </div>
        </ComponentErrorBoundary>
      )}

      {componentError && (
        <ErrorOverlay
          message={componentError.message}
          isFixing={isBeingFixed}
          onFix={handleFixErrors}
        />
      )}
    </div>
  );
}

export const ComponentNode = memo(ComponentNodeInner);
