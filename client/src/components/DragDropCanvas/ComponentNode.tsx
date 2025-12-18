import { useEffect, useState, useRef, type ComponentType, memo } from 'react';
import { NodeResizeControl, type NodeProps } from '@xyflow/react';
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
  onClearSize?: () => void; // Reset to natural size
}

function ComponentNodeInner({ data, selected, width, height }: NodeProps & { data: ComponentNodeData }) {
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
          const prevSize = intrinsicSizeRef.current;

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

  // Calculate aspect ratio for resize constraints (keeps proportions during drag)
  const aspectRatio = referenceSize ? referenceSize.width / referenceSize.height : undefined;

  // Calculate scale factor from natural size to target size
  // When user resizes, component scales proportionally
  const scale = referenceSize && data.targetSize
    ? Math.min(data.targetSize.width / referenceSize.width, data.targetSize.height / referenceSize.height)
    : 1;

  // Always shrink-wrap to content - no overflow clipping
  // Scaling is handled via CSS transform, not container sizing
  const wrapperClass = 'inline-block';

  // Show bounds when selected OR when hovering with Cmd held
  const showBounds = selected || (isHovered && cmdKeyHeld);

  return (
    <div
      className={`relative ${wrapperClass} ${cmdKeyHeld ? 'cursor-move' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => {
        setIsHovered(true);
        console.log('Component Hover:', {
          projectId: data.projectId,
          componentName: data.componentName,
          naturalSize: data.naturalSize,
          targetSize: data.targetSize,
          hasExplicitSize: data.hasExplicitSize,
          intrinsicSize: intrinsicSizeRef.current,
          scale,
          nodeBounds: { width, height }, // React Flow measured node dimensions
        });
      }}
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

      {/* Resize handle - bottom-right only */}
      {showBounds && cmdKeyHeld && (
        <NodeResizeControl
          position="bottom-right"
          minWidth={40}
          minHeight={24}
          onResize={(_event, params) => {
            data.onResize?.(Math.round(params.width), Math.round(params.height));
          }}
          style={{
            background: 'transparent',
            border: 'none',
          }}
        >
          <div className="w-3 h-3 bg-blue-500 rounded-sm cursor-se-resize" />
        </NodeResizeControl>
      )}

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
              // CSS transform for scaling (when user has resized)
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
