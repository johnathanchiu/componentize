import { useEffect, useState, useRef, type ComponentType, memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useGenerationStore } from '../../store/generationStore';
import { useCmdKey } from '../../hooks/useCmdKey';
import { loadComponent } from '../../lib/componentRenderer';
import { ComponentErrorBoundary } from './ErrorBoundary';
import { ErrorOverlay } from './ErrorOverlay';
import type { Size } from '../../types/index';

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
}

function ComponentNodeInner({ data, selected }: NodeProps & { data: ComponentNodeData }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [, forceUpdate] = useState(0); // For controlled re-renders
  const componentRef = useRef<HTMLDivElement>(null);
  const intrinsicSizeRef = useRef<Size | null>(null); // Store in ref to avoid feedback loops

  const { isGenerating, generationMode, editingComponentName, componentVersions, startEditing, startFixing } = useGenerationStore();

  // Track Cmd/Ctrl key state for pointer events
  // When Cmd is held, pointer events pass through to React Flow for drag/select
  const cmdKeyHeld = useCmdKey();

  // Track which error we've attempted to auto-fix to prevent infinite loops
  const autoFixAttemptedRef = useRef<string | null>(null);

  const componentVersion = componentVersions[data.componentName] || 0;
  const isBeingFixed = generationMode === 'fix' && editingComponentName === data.componentName && isGenerating;

  // Reset auto-fix tracking when component version changes (fix was applied)
  useEffect(() => {
    autoFixAttemptedRef.current = null;
  }, [componentVersion]);

  // Auto-trigger fix when error is detected
  useEffect(() => {
    if (!componentError || !data.componentName) return;

    // Create unique key for this error
    const errorKey = `${data.componentName}:${componentError.message}`;

    // Only auto-fix if:
    // 1. We haven't already attempted to fix this exact error
    // 2. We're not currently generating/fixing
    // 3. This component isn't already being fixed
    if (
      autoFixAttemptedRef.current !== errorKey &&
      !isGenerating &&
      editingComponentName !== data.componentName
    ) {
      autoFixAttemptedRef.current = errorKey;
      // Small delay to avoid race conditions with other state updates
      const timer = setTimeout(() => {
        startFixing(data.componentName, {
          message: componentError.message,
          stack: componentError.stack,
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [componentError, data.componentName, isGenerating, editingComponentName, startFixing]);

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

  // Monitor component size with ResizeObserver
  // Captures natural size initially and updates node bounds when content changes dynamically
  useEffect(() => {
    if (!componentRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const newSize = { width: Math.round(width), height: Math.round(height) };
          const prevSize = intrinsicSizeRef.current;

          // Update local ref for current measurement
          intrinsicSizeRef.current = newSize;

          // If no naturalSize stored yet, capture the initial snapshot
          if (!data.naturalSize) {
            data.onNaturalSizeChange?.(newSize);
            forceUpdate(n => n + 1);
          }
          // If component hasn't been manually resized AND size changed significantly,
          // update the node to match the new content size
          else if (!data.hasExplicitSize && prevSize) {
            const widthChanged = Math.abs(newSize.width - prevSize.width) > 2;
            const heightChanged = Math.abs(newSize.height - prevSize.height) > 2;
            if (widthChanged || heightChanged) {
              // Update naturalSize to new intrinsic size
              data.onNaturalSizeChange?.(newSize);
              forceUpdate(n => n + 1);
            }
          }
        }
      }
    });

    resizeObserver.observe(componentRef.current);
    return () => resizeObserver.disconnect();
  }, [Component, data.naturalSize, data.hasExplicitSize, data.onNaturalSizeChange]);

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

  // Use stored naturalSize for scale calculation
  const referenceSize = data.naturalSize || intrinsicSizeRef.current;

  // Calculate aspect ratio for resize constraints (keeps proportions during drag)
  const aspectRatio = referenceSize ? referenceSize.width / referenceSize.height : undefined;

  // Calculate scale factor (aspect ratio is maintained, so width/height ratios are equal)
  const scale = referenceSize && data.targetSize
    ? data.targetSize.width / referenceSize.width
    : 1;

  // Two-mode sizing system:
  // Mode 1 (Natural Size): component renders at natural size, shrink-wrapped
  // Mode 2 (Explicit Size): component scaled to cover container, overflow clipped
  const wrapperClass = data.hasExplicitSize
    ? 'w-full h-full overflow-hidden'  // Container clips scaled content
    : 'inline-block';  // Shrink to content

  // Show bounds when selected OR when hovering with Cmd held
  const showBounds = selected || (isHovered && cmdKeyHeld);

  return (
    <div
      className={`relative ${wrapperClass} ${cmdKeyHeld ? 'cursor-move' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Bounds outline - shown when selected or hovering with Cmd held */}
      {showBounds && (
        <div
          className={`absolute inset-[-4px] border-2 rounded-lg pointer-events-none ${
            selected ? 'border-blue-500' : 'border-blue-400 border-dashed'
          }`}
        />
      )}

      {/* Resize handle - shown when (selected OR hovered) AND Cmd/Ctrl is held */}
      <NodeResizer
        isVisible={showBounds && cmdKeyHeld}
        minWidth={40}
        minHeight={24}
        keepAspectRatio={!!aspectRatio}
        onResize={(_event, params) => {
          // Normalize to maintain component's natural aspect ratio
          // This ensures node bounds always match scaled component dimensions
          if (referenceSize) {
            const scaleFromWidth = params.width / referenceSize.width;
            const scaleFromHeight = params.height / referenceSize.height;
            // Use the larger scale to ensure component fills the drag target
            const newScale = Math.max(scaleFromWidth, scaleFromHeight);
            const newWidth = Math.round(referenceSize.width * newScale);
            const newHeight = Math.round(referenceSize.height * newScale);
            data.onResize?.(newWidth, newHeight);
          } else {
            data.onResize?.(Math.round(params.width), Math.round(params.height));
          }
        }}
        onResizeEnd={(_event, params) => {
          // Final update with same normalization
          if (referenceSize) {
            const scaleFromWidth = params.width / referenceSize.width;
            const scaleFromHeight = params.height / referenceSize.height;
            const newScale = Math.max(scaleFromWidth, scaleFromHeight);
            const newWidth = Math.round(referenceSize.width * newScale);
            const newHeight = Math.round(referenceSize.height * newScale);
            data.onResize?.(newWidth, newHeight);
          } else {
            data.onResize?.(Math.round(params.width), Math.round(params.height));
          }
        }}
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
            className="p-2"
            style={{
              // Absolute positioning for scaled rendering
              position: data.hasExplicitSize ? 'absolute' : undefined,
              top: 0,
              left: 0,
              // CSS transform for scaling
              transformOrigin: 'top left',
              transform: scale !== 1 ? `scale(${scale})` : undefined,
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
