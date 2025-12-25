import { useEffect, useState, useRef, type ComponentType, memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  useIsGenerating,
  useGenerationMode,
  useEditingComponentName,
  useComponentVersion,
  useGenerationActions,
} from '@/store/generationStore';
import { compileComponent } from '@/lib/componentRenderer';
import { ComponentErrorBoundary } from './ErrorBoundary';
import { ErrorOverlay } from './ErrorOverlay';
import type { Size } from '@/shared/types';

export interface ComponentNodeData extends Record<string, unknown> {
  componentName: string;
  projectId: string;
  targetSize?: Size;
  onFix?: (errorMessage: string, errorStack?: string) => void;
  onConnectionsDetected?: (source: string) => void;
}

function ComponentNodeInner({ data, selected }: NodeProps & { data: ComponentNodeData }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Use typed selector hooks for optimal re-rendering
  const isGenerating = useIsGenerating();
  const generationMode = useGenerationMode();
  const editingComponentName = useEditingComponentName();
  const componentVersion = useComponentVersion(data.componentName);
  const { startEditing } = useGenerationActions();

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

  // Container style - use size from layout, no overflow clipping
  const containerStyle: React.CSSProperties = data.targetSize
    ? {
        width: data.targetSize.width,
        height: data.targetSize.height,
      }
    : {};

  // Selection/hover styling
  const selectionStyle: React.CSSProperties = selected
    ? {
        outline: '2px solid #3b82f6',
        outlineOffset: '2px',
        boxShadow: '0 4px 20px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(0, 0, 0, 0.08)',
      }
    : isHovered
      ? {
          outline: '1px solid #a3a3a3',
          outlineOffset: '2px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        }
      : {};

  return (
    <div
      className="relative"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main container - no overflow hidden, no rounded */}
      <div
        className="relative"
        style={{ ...containerStyle, ...selectionStyle }}
      >
        {/* Component content */}
        {loading && (
          <div className="flex items-center justify-center text-xs text-neutral-400" style={containerStyle}>
            Loading...
          </div>
        )}
        {!loading && Component && (
          <ComponentErrorBoundary
            onError={(error) => setComponentError({ message: error.message, stack: error.stack })}
            resetKey={componentVersion}
          >
            <Component />
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
    </div>
  );
}

export const ComponentNode = memo(ComponentNodeInner);
