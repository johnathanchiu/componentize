import { useCallback, useMemo, useEffect, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Controls,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Link2, Link2Off } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useGenerationStore } from '../../store/generationStore';
import { useProjectStore } from '../../store/projectStore';
import { useCmdKey } from '../../hooks/useCmdKey';
import { groupConnectionsByKey, generateConnectionColors } from '../../lib/sharedStore';
import { ComponentNode, type ComponentNodeData } from './ComponentNode';

// Register custom node types - must be outside component to prevent re-renders
const nodeTypes = {
  component: ComponentNode,
};

function DragDropCanvasInner() {
  const { screenToFlowPosition } = useReactFlow();
  const { currentProject } = useProjectStore();
  const {
    canvasComponents,
    selectedComponentId,
    setSelectedComponentId,
    updateSize,
    updatePosition,
    addToCanvas,
    stateConnections,
    showConnections,
    toggleShowConnections,
  } = useCanvasStore();
  const { setGenerationMode, setEditingComponentName } = useGenerationStore();

  // Track Cmd/Ctrl key for edit mode
  const cmdKeyHeld = useCmdKey();

  // ============================================
  // NODES: Zustand → Derived → React Flow State
  // ============================================

  // Step 1: Derive nodes from Zustand store (source of truth)
  const derivedNodes = useMemo((): Node<ComponentNodeData>[] => {
    if (!currentProject) return [];

    return canvasComponents.map((item) => ({
      id: item.id,
      type: 'component',
      position: { x: item.position.x, y: item.position.y },
      data: {
        componentName: item.componentName,
        projectId: currentProject.id,
        naturalSize: item.size,
        _componentId: item.id,
      },
      selected: selectedComponentId === item.id,
      style: item.size ? { width: item.size.width, height: item.size.height } : undefined,
    }));
  }, [canvasComponents, currentProject, selectedComponentId]);

  // Step 2: React Flow local state (allows RF to handle drag/select smoothly)
  const [nodes, setNodes] = useState<Node<ComponentNodeData>[]>([]);

  // Step 3: Sync derived nodes → React Flow state, preserving RF's internal measurements
  useEffect(() => {
    setNodes((currentNodes) => {
      // Build map of current nodes for O(1) lookup
      const nodeMap = new Map(currentNodes.map((n) => [n.id, n]));

      return derivedNodes.map((derived) => {
        const existing = nodeMap.get(derived.id);
        if (existing) {
          // Preserve React Flow's measured/computed properties, update our data
          return {
            ...existing,
            position: derived.position,
            data: derived.data,
            selected: derived.selected,
            style: derived.style,
          };
        }
        // New node - use derived values
        return derived;
      });
    });
  }, [derivedNodes]);

  // ============================================
  // EDGES: Derived from state connections
  // ============================================

  const edges = useMemo((): Edge[] => {
    if (!showConnections || stateConnections.length === 0) return [];

    const grouped = groupConnectionsByKey(stateConnections);
    const stateKeys = Object.keys(grouped);
    const colors = generateConnectionColors(stateKeys.length);
    const edgeList: Edge[] = [];

    stateKeys.forEach((stateKey, keyIndex) => {
      const conns = grouped[stateKey];
      const color = colors[keyIndex];

      const writers = conns.filter((c) => c.accessType === 'write' || c.accessType === 'both');
      const readers = conns.filter((c) => c.accessType === 'read' || c.accessType === 'both');

      // Create edges from writers to readers
      writers.forEach((writer) => {
        readers.forEach((reader) => {
          if (writer.componentId !== reader.componentId) {
            edgeList.push({
              id: `${stateKey}-${writer.componentId}-${reader.componentId}`,
              source: writer.componentId,
              target: reader.componentId,
              animated: true,
              style: { stroke: color, strokeWidth: 2 },
              label: stateKey,
              labelStyle: { fill: color, fontWeight: 500, fontSize: 10 },
              labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
            });
          }
        });
      });

      // If no writers, connect readers in chain (shared state visualization)
      if (writers.length === 0 && readers.length > 1) {
        for (let i = 0; i < readers.length - 1; i++) {
          edgeList.push({
            id: `${stateKey}-${readers[i].componentId}-${readers[i + 1].componentId}`,
            source: readers[i].componentId,
            target: readers[i + 1].componentId,
            animated: true,
            style: { stroke: color, strokeWidth: 2, strokeDasharray: '5,5' },
            label: stateKey,
            labelStyle: { fill: color, fontWeight: 500, fontSize: 10 },
            labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
          });
        }
      }
    });

    return edgeList;
  }, [stateConnections, showConnections]);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Handle React Flow node changes.
   * We allow position and dimension changes to flow through to RF state,
   * but only persist to Zustand store at specific times (drag end, resize).
   */
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<ComponentNodeData>>[]) => {
      // Apply all changes to React Flow state for smooth interactions
      setNodes((current) => applyNodeChanges(changes, current));

      // Sync specific changes back to Zustand store
      changes.forEach((change) => {
        if (change.type === 'dimensions' && change.dimensions) {
          // Sync size changes (from NodeResizer)
          const component = canvasComponents.find((c) => c.id === change.id);
          const newWidth = Math.round(change.dimensions.width);
          const newHeight = Math.round(change.dimensions.height);

          // Only update if actually changed (prevents infinite loop)
          if (
            !component?.size ||
            component.size.width !== newWidth ||
            component.size.height !== newHeight
          ) {
            updateSize(change.id, newWidth, newHeight);
          }
        } else if (change.type === 'select') {
          // Sync selection to store
          if (change.selected) {
            setSelectedComponentId(change.id);
          } else if (selectedComponentId === change.id) {
            setSelectedComponentId(null);
          }
        }
        // Position changes are applied to RF state but NOT persisted here
        // They are persisted in onNodeDragStop
      });
    },
    [canvasComponents, updateSize, setSelectedComponentId, selectedComponentId]
  );

  /**
   * Persist position to Zustand store when drag ends.
   * This is the only place we write position back to the store.
   */
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      updatePosition(node.id, node.position.x, node.position.y);
    },
    [updatePosition]
  );

  /**
   * Handle pane click - deselect and reset editing state.
   */
  const handlePaneClick = useCallback(() => {
    setSelectedComponentId(null);
    setEditingComponentName(null);
    setGenerationMode('create');
  }, [setSelectedComponentId, setEditingComponentName, setGenerationMode]);

  // ============================================
  // DRAG & DROP FROM LIBRARY
  // ============================================

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const componentName = event.dataTransfer.getData('application/componentName');
      if (!componentName) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addToCanvas({
        id: `${componentName}-${Date.now()}`,
        componentName,
        position: { x: position.x, y: position.y },
      });
    },
    [screenToFlowPosition, addToCanvas]
  );

  // ============================================
  // RENDER
  // ============================================

  const hasConnections = stateConnections.length > 0;

  return (
    <div className="h-full w-full relative" data-canvas="true">
      {canvasComponents.length === 0 ? (
        // Empty state
        <div
          className="h-full flex items-center justify-center bg-neutral-50"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="text-center text-neutral-400">
            <div className="text-base mb-1">Drop components here</div>
            <div className="text-sm">Drag from the library to start building</div>
          </div>
        </div>
      ) : (
        // Canvas with components
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          // Only allow dragging when Cmd/Ctrl is held
          nodesDraggable={cmdKeyHeld}
          // Disable multi-selection (prevents both nodes moving when switching selection)
          multiSelectionKeyCode={null}
          // Disable selection box drag
          selectionOnDrag={false}
          // Viewport settings
          fitView={false}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#D4D4D4" />
          <MiniMap
            nodeColor="#a3a3a3"
            nodeStrokeWidth={3}
            maskColor="rgba(255, 255, 255, 0.8)"
            className="!bg-white/90 !border-neutral-300"
            zoomable
            pannable
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      )}

      {/* Connections toggle button */}
      {hasConnections && (
        <div className="absolute top-3 right-3 z-50">
          <button
            onClick={toggleShowConnections}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors shadow-sm ${
              showConnections
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
            title={showConnections ? 'Hide state connections' : 'Show state connections'}
          >
            {showConnections ? (
              <>
                <Link2 className="w-3.5 h-3.5" />
                <span>Hide Connections</span>
              </>
            ) : (
              <>
                <Link2Off className="w-3.5 h-3.5" />
                <span>Show Connections</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * DragDropCanvas - Main canvas component with React Flow.
 * Wrapped in ReactFlowProvider for context access.
 */
export function DragDropCanvas() {
  return (
    <ReactFlowProvider>
      <DragDropCanvasInner />
    </ReactFlowProvider>
  );
}
