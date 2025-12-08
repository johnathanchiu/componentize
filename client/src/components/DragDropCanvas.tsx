import { useDroppable } from '@dnd-kit/core';
import { Trash2, AlertCircle, Wrench, Pencil, GripHorizontal } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { useProjectStore } from '../store/projectStore';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import { InteractionPanel } from './InteractionPanel';
import { ConnectionsOverlay, ConnectionsLegend, ConnectionsToggle } from './ConnectionsOverlay';
import { Resizable } from 're-resizable';
import type { Size, Interaction } from '../types/index';
import { useEffect, useState, useRef, useCallback, useMemo, type ComponentType } from 'react';
import { loadComponent } from '../lib/componentRenderer';
import { detectStateConnections } from '../lib/sharedStore';

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

function CanvasItem({ id, componentName, projectId, x, y, size, isSelected, onSelect, onEdit, onDelete, onResize, onFix, onConnectionsDetected, interactions }: CanvasItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas-${id}`,
    data: { id, componentName, source: 'canvas' },
  });

  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [loading, setLoading] = useState(true);
  const componentRef = useRef<HTMLDivElement>(null);
  const { isGenerating, generationMode, editingComponentName, componentVersions } = useCanvasStore();

  // Get version for this component (used to reload on changes)
  const componentVersion = componentVersions[componentName] || 0;

  // Track if this component is currently being fixed
  const isBeingFixed = generationMode === 'fix' && editingComponentName === componentName && isGenerating;

  // Compute dynamic control positioning based on component location
  // Controls flip below when near top, and move to opposite side when near edges
  const controlPosition = useMemo(() => {
    const TOOLBAR_HEIGHT = 36; // Height of the toolbar + gap
    const EDGE_THRESHOLD = 50; // Distance from edge to trigger flip

    // Check if near top edge
    const nearTop = y < TOOLBAR_HEIGHT + EDGE_THRESHOLD;

    // Check if near left edge (controls would go off-screen to the left)
    const nearLeft = x < EDGE_THRESHOLD;

    // For components at far right, we need to check if they're near the right edge
    // of the canvas scroll area. Use a reasonable canvas width estimate.
    // Controls will be placed to the LEFT of the component when near right edge.
    const componentWidth = size?.width || 120;
    const canvasWidth = typeof window !== 'undefined' ? window.innerWidth - 350 : 1000; // Approximate canvas width
    const nearRight = x + componentWidth > canvasWidth - EDGE_THRESHOLD;

    return {
      vertical: nearTop ? 'bottom' : 'top',
      // Place controls on opposite side when near an edge
      horizontal: nearRight ? 'outsideLeft' : nearLeft ? 'outsideRight' : 'left',
    };
  }, [x, y, size?.width]);

  // Store callback in ref to avoid re-triggering effect
  const connectionsCallbackRef = useRef(onConnectionsDetected);
  connectionsCallbackRef.current = onConnectionsDetected;

  // Track last observed size to avoid redundant updates
  const lastSizeRef = useRef<Size | null>(null);

  // Load component when projectId, componentName, or version changes
  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    setComponentError(null);

    // Fetch source and compile component
    fetch(`/api/projects/${projectId}/components/${componentName}`, {
      signal: abortController.signal,
    })
      .then((res) => res.text())
      .then((source) => {
        // Check if aborted
        if (abortController.signal.aborted) return;

        // Detect state connections from source (use ref to avoid dependency)
        connectionsCallbackRef.current(source);

        // Compile and set component
        return loadComponent(projectId, componentName);
      })
      .then((comp) => {
        if (abortController.signal.aborted || !comp) return;
        setComponent(() => comp);
        setLoading(false);
      })
      .catch((err) => {
        // Ignore abort errors
        if (err.name === 'AbortError') return;
        console.error('Failed to load component:', err);
        setComponentError({ message: err.message, stack: err.stack });
        setLoading(false);
      });

    return () => abortController.abort();
  }, [projectId, componentName, componentVersion]);

  // Measure natural size using ResizeObserver on the actual component
  // Debounced to avoid rapid re-renders
  useEffect(() => {
    if (!Component || !componentRef.current) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const newSize = { width: Math.round(width), height: Math.round(height) };

          // Skip if size hasn't actually changed
          const lastSize = lastSizeRef.current;
          if (lastSize && lastSize.width === newSize.width && lastSize.height === newSize.height) {
            return;
          }

          // Debounce the update
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            lastSizeRef.current = newSize;
            setNaturalSize(newSize);
          }, 50);
        }
      }
    });

    observer.observe(componentRef.current);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
    };
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

  // Use stored size (user resized), or natural size, or fallback
  const displaySize = useMemo(
    () => size || naturalSize || { width: 120, height: 40 },
    [size, naturalSize]
  );

  // Calculate scale factor for when user has resized the component
  const scale = size && naturalSize && naturalSize.width > 0
    ? size.width / naturalSize.width
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
      {/* Floating action buttons - appear on hover, position adapts to edges */}
      <div
        className={`absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 flex gap-1 items-center ${
          controlPosition.vertical === 'bottom' ? 'top-full mt-1' : '-top-8'
        } ${
          controlPosition.horizontal === 'outsideLeft'
            ? 'right-full mr-1'
            : controlPosition.horizontal === 'outsideRight'
            ? 'left-full ml-1'
            : 'left-0'
        }`}
      >
        {/* Drag handle */}
        <div
          {...listeners}
          {...attributes}
          className="p-1.5 bg-neutral-700 hover:bg-neutral-800 rounded shadow-sm cursor-move"
          title="Drag to move"
        >
          <GripHorizontal className="w-3 h-3 text-white" />
        </div>
        {/* Component name */}
        <div className="px-2 py-1 bg-neutral-800 text-white text-[10px] font-medium rounded whitespace-nowrap">
          {componentName}
        </div>
        {/* Edit button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 bg-blue-500 hover:bg-blue-600 rounded shadow-sm"
          title="Edit component"
        >
          <Pencil className="w-3 h-3 text-white" />
        </button>
        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 bg-red-500 hover:bg-red-600 rounded shadow-sm"
          title="Remove component"
        >
          <Trash2 className="w-3 h-3 text-white" />
        </button>
      </div>

      <Resizable
        size={displaySize}
        onResizeStop={(_e, _direction, _ref, d) => {
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
          bottomRight: {
            bottom: 0,
            right: 0,
            width: 12,
            height: 12,
            cursor: 'se-resize',
          },
        }}
        handleClasses={{
          bottomRight: 'opacity-0 group-hover:opacity-100 transition-opacity',
        }}
        handleComponent={{
          bottomRight: (
            <div className="w-3 h-3 bg-blue-500 rounded-tl" />
          ),
        }}
        enable={{
          top: false,
          right: false,
          bottom: false,
          left: false,
          topRight: false,
          bottomRight: true,
          bottomLeft: false,
          topLeft: false,
        }}
      >
        {/* Direct component rendering - no iframe! */}
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="text-xs text-neutral-400">Loading...</div>
          )}
          {!loading && Component && (
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
          )}
        </div>

        {/* Error overlay */}
        {componentError && (
          <div className="absolute inset-0 bg-red-50/95 flex flex-col items-center justify-center p-2 z-20">
            <AlertCircle className="w-6 h-6 text-red-500 mb-1" />
            <div className="text-xs font-medium text-red-800 mb-1">Error</div>
            <div className="text-[10px] text-red-600 text-center mb-2 max-w-full overflow-hidden line-clamp-2">
              {componentError.message}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFixErrors();
              }}
              disabled={isBeingFixed}
              className="px-2 py-1 bg-red-500 text-white rounded text-[10px] font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
            >
              <Wrench className={`w-3 h-3 ${isBeingFixed ? 'animate-spin' : ''}`} />
              {isBeingFixed ? 'Fixing...' : 'Fix'}
            </button>
          </div>
        )}
      </Resizable>

      {/* Interaction count badge - moves to avoid overlap with controls */}
      {interactions && interactions.length > 0 && (
        <div
          className={`absolute px-1.5 py-0.5 bg-neutral-600 text-white text-[9px] rounded shadow-sm pointer-events-none z-20 ${
            controlPosition.vertical === 'bottom' ? '-top-5' : '-bottom-5'
          } ${
            controlPosition.horizontal === 'outsideLeft'
              ? 'right-0'
              : controlPosition.horizontal === 'outsideRight'
              ? 'left-0'
              : 'left-0'
          }`}
        >
          {interactions.length} interaction{interactions.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Interaction Panel */}
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

export function DragDropCanvas() {
  const { setNodeRef } = useDroppable({
    id: 'canvas',
  });

  const { currentProject } = useProjectStore();
  const {
    canvasComponents,
    selectedComponentId,
    setSelectedComponentId,
    removeFromCanvas,
    updateSize,
    startFixing,
    startEditing,
    stateConnections,
    showConnections,
    addStateConnections,
    removeComponentConnections,
  } = useCanvasStore();

  // Handler to start fixing a component with an error - auto-triggers fix
  const handleFix = (componentName: string, errorMessage: string, errorStack?: string) => {
    startFixing(componentName, { message: errorMessage, stack: errorStack });
  };

  // Handler to start editing a component
  const handleEdit = (componentName: string) => {
    startEditing(componentName);
  };

  // Create stable callback for detecting connections from a component's source
  // Memoized to avoid creating new function references on every render
  const createConnectionsCallback = useCallback(
    (componentId: string, componentName: string) => {
      return (source: string) => {
        const connections = detectStateConnections(source, componentId, componentName);
        if (connections.length > 0) {
          addStateConnections(connections);
        } else {
          // Remove any existing connections for this component if it no longer has any
          removeComponentConnections(componentId);
        }
      };
    },
    [addStateConnections, removeComponentConnections]
  );

  return (
    <div className="h-full overflow-hidden">
      <div
        ref={setNodeRef}
        data-canvas="true"
        className="relative w-full h-full overflow-auto"
        style={{
          backgroundColor: '#FAFAFA',
          backgroundImage: 'radial-gradient(circle, #D4D4D4 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
        onClick={() => setSelectedComponentId(null)}
      >
        {canvasComponents.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-neutral-400">
              <div className="text-base mb-1">Drop components here</div>
              <div className="text-sm">Drag from the library to start building</div>
            </div>
          </div>
        ) : currentProject ? (
          canvasComponents.map((item) => (
            <CanvasItem
              key={item.id}
              id={item.id}
              componentName={item.componentName}
              projectId={currentProject.id}
              x={item.position.x}
              y={item.position.y}
              size={item.size}
              isSelected={selectedComponentId === item.id}
              onSelect={() => setSelectedComponentId(item.id)}
              onEdit={() => handleEdit(item.componentName)}
              onDelete={() => removeFromCanvas(item.id)}
              onResize={(width, height) => updateSize(item.id, width, height)}
              onFix={(errorMessage, errorStack) => handleFix(item.componentName, errorMessage, errorStack)}
              onConnectionsDetected={createConnectionsCallback(item.id, item.componentName)}
              interactions={item.interactions}
            />
          ))
        ) : null}

        {/* Visual connections between components sharing state */}
        <ConnectionsOverlay connections={stateConnections} visible={showConnections} />
        <ConnectionsLegend />
      </div>

      {/* Toggle button for connections (top-right corner) */}
      <div className="absolute top-3 right-3 z-50">
        <ConnectionsToggle />
      </div>
    </div>
  );
}
