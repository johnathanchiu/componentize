import { useEffect, useState, useRef, memo, type ComponentType } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useCmdKey } from '../../hooks/useCmdKey';
import { compileComponent } from '../../lib/componentRenderer';
import { LayoutRenderer, extractComponentNames, type LoadedComponents } from '../../lib/layoutRenderer';
import type { LayoutDefinition, Size } from '../../types/index';
import { getProjectLayout } from '../../lib/api';

export interface LayoutNodeData extends Record<string, unknown> {
  layoutName: string;
  projectId: string;
  targetSize?: Size;
  hasExplicitSize?: boolean;
  onResize?: (width: number, height: number) => void;
}

interface LoadState {
  layout: LayoutDefinition | null;
  components: LoadedComponents;
  error: string | null;
  loading: boolean;
}

function LayoutNodeInner({ data, selected }: NodeProps & { data: LayoutNodeData }) {
  const [state, setState] = useState<LoadState>({
    layout: null,
    components: new Map(),
    error: null,
    loading: true,
  });
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track Cmd/Ctrl key state for pointer events
  const cmdKeyHeld = useCmdKey();

  // Load layout definition and all referenced components
  useEffect(() => {
    const abortController = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));

    async function loadLayout() {
      try {
        // 1. Fetch layout definition
        const result = await getProjectLayout(data.projectId, data.layoutName);
        if (abortController.signal.aborted) return;

        if (result.status !== 'success' || !result.layout) {
          throw new Error(result.message || 'Failed to load layout');
        }

        const layout = result.layout;

        // 2. Extract component names from layout
        const componentNames = extractComponentNames(layout);

        // 3. Load all components in parallel
        const loadedComponents: LoadedComponents = new Map();

        await Promise.all(
          componentNames.map(async (name) => {
            try {
              const res = await fetch(`/api/projects/${data.projectId}/components/${name}`, {
                signal: abortController.signal,
              });
              if (!res.ok) throw new Error(`Failed to fetch ${name}`);
              const source = await res.text();
              const Component = compileComponent(source, name);
              loadedComponents.set(name, Component as ComponentType);
            } catch (err) {
              if ((err as Error).name !== 'AbortError') {
                console.error(`Failed to load component ${name}:`, err);
                // Store error placeholder
                loadedComponents.set(name, () => (
                  <div className="p-2 text-xs text-red-500 border border-red-300 rounded">
                    Failed to load: {name}
                  </div>
                ));
              }
            }
          })
        );

        if (abortController.signal.aborted) return;

        setState({
          layout,
          components: loadedComponents,
          error: null,
          loading: false,
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('Failed to load layout:', err);
        setState((s) => ({
          ...s,
          error: (err as Error).message,
          loading: false,
        }));
      }
    }

    loadLayout();
    return () => abortController.abort();
  }, [data.projectId, data.layoutName]);

  // Show bounds when selected OR when hovering with Cmd held
  const showBounds = selected || (isHovered && cmdKeyHeld);

  return (
    <div
      className={`relative ${cmdKeyHeld ? 'cursor-move' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={containerRef}
    >
      {/* Bounds outline */}
      {showBounds && (
        <div
          className={`absolute inset-[-4px] border-2 rounded-lg pointer-events-none ${
            selected ? 'border-purple-500' : 'border-purple-400 border-dashed'
          }`}
        />
      )}

      {/* Layout badge */}
      <div className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 bg-purple-100 rounded">
        {data.layoutName}
      </div>

      {/* Resize handle */}
      <NodeResizer
        isVisible={showBounds && cmdKeyHeld}
        minWidth={100}
        minHeight={60}
        onResizeEnd={(_event, params) => {
          data.onResize?.(Math.round(params.width), Math.round(params.height));
        }}
      />

      {/* Layout content */}
      <div
        className="p-2"
        style={{
          pointerEvents: cmdKeyHeld ? 'none' : 'auto',
          width: data.targetSize?.width,
          height: data.targetSize?.height,
          overflow: data.hasExplicitSize ? 'auto' : undefined,
        }}
      >
        {state.loading && (
          <div className="flex items-center justify-center p-4 text-xs text-neutral-400 min-w-[100px] min-h-[60px]">
            Loading layout...
          </div>
        )}

        {state.error && (
          <div className="p-4 text-xs text-red-500 border border-red-300 bg-red-50 rounded min-w-[100px]">
            Error: {state.error}
          </div>
        )}

        {!state.loading && !state.error && state.layout && (
          <LayoutRenderer
            layout={state.layout}
            loadedComponents={state.components}
          />
        )}
      </div>
    </div>
  );
}

export const LayoutNode = memo(LayoutNodeInner);
