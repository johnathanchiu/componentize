import { useEffect, useState, useRef, type ComponentType, memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useGenerationStore } from '../../store/generationStore';
import { compileComponent } from '../../lib/componentRenderer';
import { ComponentErrorBoundary } from './ErrorBoundary';
import { ErrorOverlay } from './ErrorOverlay';
import type { Size } from '../../types/index';

// Default size for components that don't have an explicit size set
const DEFAULT_SIZE: Size = { width: 200, height: 120 };

// Resize handle component - extracted for clarity
interface ResizeHandleProps {
  startWidth: number;
  startHeight: number;
  onResize?: (width: number, height: number) => void;
}

function ResizeHandle({ startWidth, startHeight, onResize }: ResizeHandleProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const initialX = e.clientX;
    const initialY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - initialX;
      const deltaY = moveEvent.clientY - initialY;

      // Minimum size constraints
      const newWidth = Math.max(100, startWidth + deltaX);
      const newHeight = Math.max(80, startHeight + deltaY);

      onResize?.(Math.round(newWidth), Math.round(newHeight));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="nodrag nopan absolute"
      style={{
        bottom: -8,
        right: -8,
        width: 16,
        height: 16,
        backgroundColor: '#3b82f6',
        border: '2px solid white',
        borderRadius: 4,
        cursor: 'nwse-resize',
        zIndex: 1001,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      }}
    />
  );
}

export interface ComponentNodeData extends Record<string, unknown> {
  componentName: string;
  projectId: string;
  targetSize?: Size; // User-set size (actual container dimensions)
  onFix?: (errorMessage: string, errorStack?: string) => void;
  onConnectionsDetected?: (source: string) => void;
  onResize?: (width: number, height: number) => void;
  onClearSize?: () => void; // Reset to default size
}

function ComponentNodeInner({ data, selected }: NodeProps & { data: ComponentNodeData }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const { isGenerating, generationMode, editingComponentName, componentVersions, startEditing } = useGenerationStore();

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
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load: ${res.statusText}`);
        return res.text();
      })
      .then((source) => {
        if (abortController.signal.aborted) return;
        connectionsCallbackRef.current?.(source);
        // Compile directly - no second fetch needed
        const comp = compileComponent(source, data.componentName);
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

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Double-click to reset size to default
    if (data.targetSize && data.onClearSize) {
      e.stopPropagation();
      console.log('Clearing size for:', data.componentName);
      data.onClearSize();
    }
  };

  // Get current size - use targetSize or default
  const currentSize = data.targetSize || DEFAULT_SIZE;

  // Container style - set actual width/height on the container
  // Component uses w-full h-full to fill this container and reflows naturally
  const containerStyle: React.CSSProperties = {
    width: currentSize.width,
    height: currentSize.height,
    overflow: 'hidden',
  };

  // Use CSS outline for selection/hover - it renders OUTSIDE the element and is never clipped
  const outlineStyle: React.CSSProperties = selected
    ? { outline: '2px solid #3b82f6', outlineOffset: '2px' }
    : isHovered
      ? { outline: '2px solid #737373', outlineOffset: '2px' }
      : {};

  return (
    <div
      className="relative"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main container with outline-based selection/hover indicator */}
      <div
        className="relative rounded"
        style={{ ...containerStyle, ...outlineStyle }}
      >
        {/* Component content - fills container naturally via w-full h-full */}
        {loading && (
          <div className="flex items-center justify-center w-full h-full text-xs text-neutral-400">
            Loading...
          </div>
        )}
        {!loading && Component && (
          <ComponentErrorBoundary
            onError={(error) => setComponentError({ message: error.message, stack: error.stack })}
            resetKey={componentVersion}
          >
            <div className="w-full h-full">
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

      {/* Resize handle - sibling to content container, positioned at bottom-right */}
      {(selected || isHovered) && (
        <ResizeHandle
          startWidth={currentSize.width}
          startHeight={currentSize.height}
          onResize={data.onResize}
        />
      )}
    </div>
  );
}

export const ComponentNode = memo(ComponentNodeInner);
