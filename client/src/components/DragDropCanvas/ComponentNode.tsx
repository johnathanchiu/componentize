import { useEffect, useState, useRef, type ComponentType, memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useGenerationStore } from '../../store/generationStore';
import { compileComponent } from '../../lib/componentRenderer';
import { ComponentErrorBoundary } from './ErrorBoundary';
import { ErrorOverlay } from './ErrorOverlay';
import type { Size } from '../../types/index';

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

      const newWidth = Math.max(40, startWidth + deltaX);
      const newHeight = Math.max(24, startHeight + deltaY);

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
  targetSize?: Size; // User-set size after resize
  naturalSize?: Size; // Stored reference size for scaling (persisted)
  hasExplicitSize?: boolean;
  onFix?: (errorMessage: string, errorStack?: string) => void;
  onConnectionsDetected?: (source: string) => void;
  onNaturalSizeChange?: (size: Size) => void;
  onResize?: (width: number, height: number) => void;
  onClearSize?: () => void; // Reset to natural size
}

function ComponentNodeInner({ data, selected }: NodeProps & { data: ComponentNodeData }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [, forceUpdate] = useState(0); // For controlled re-renders
  const componentRef = useRef<HTMLDivElement>(null);
  const intrinsicSizeRef = useRef<Size | null>(null); // Store in ref to avoid feedback loops

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

  // Monitor component size with ResizeObserver
  // Captures natural size initially and updates when content changes dynamically
  // This keeps scale calculations accurate even after resize
  useEffect(() => {
    if (!componentRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const newSize = { width: Math.round(width), height: Math.round(height) };

          // Update local ref for current measurement
          intrinsicSizeRef.current = newSize;

          // If no naturalSize stored yet, capture the initial snapshot
          if (!data.naturalSize) {
            data.onNaturalSizeChange?.(newSize);
            forceUpdate(n => n + 1);
          }
          // Always update naturalSize when content size differs from stored naturalSize
          // This keeps scale calculations accurate (targetSize / naturalSize)
          // Compare with data.naturalSize, not prevSize, to detect drift
          else if (data.naturalSize) {
            const widthDrift = Math.abs(newSize.width - data.naturalSize.width) >= 2;
            const heightDrift = Math.abs(newSize.height - data.naturalSize.height) >= 2;
            if (widthDrift || heightDrift) {
              // Update naturalSize to match current content
              data.onNaturalSizeChange?.(newSize);
              forceUpdate(n => n + 1);
            }
          }
        }
      }
    });

    resizeObserver.observe(componentRef.current);
    return () => resizeObserver.disconnect();
  }, [Component, data.naturalSize, data.onNaturalSizeChange]);

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
    // Double-click to reset size to natural
    if (data.hasExplicitSize && data.onClearSize) {
      e.stopPropagation();
      console.log('Clearing size for:', data.componentName);
      data.onClearSize();
    }
  };

  // Use stored naturalSize for scale calculation
  const referenceSize = data.naturalSize || intrinsicSizeRef.current;

  // Calculate scale factor from natural size to target size
  // When user resizes, component scales proportionally
  const scale = referenceSize && data.targetSize
    ? Math.min(
      data.targetSize.width / referenceSize.width,
      data.targetSize.height / referenceSize.height
    )
    : 1;

  // When user has set explicit size, use fixed container dimensions
  // Otherwise, shrink-wrap to content (inline-block)
  const containerStyle: React.CSSProperties = data.targetSize
    ? {
      width: data.targetSize.width,
      height: data.targetSize.height,
      overflow: 'hidden',
    }
    : {};

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
        className={`relative rounded ${data.targetSize ? '' : 'inline-block'}`}
        style={{ ...containerStyle, ...outlineStyle }}
      >
        {/* Component content */}
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
              className={data.targetSize ? 'w-full h-full' : ''}
              style={{
                transformOrigin: 'top left',
                transform: scale !== 1 ? `scale(${scale})` : undefined,
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

      {/* Resize handle - sibling to content container, positioned at bottom-right */}
      {(selected || isHovered) && (
        <ResizeHandle
          startWidth={data.targetSize?.width || referenceSize?.width || 200}
          startHeight={data.targetSize?.height || referenceSize?.height || 100}
          onResize={data.onResize}
        />
      )}
    </div>
  );
}

export const ComponentNode = memo(ComponentNodeInner);
