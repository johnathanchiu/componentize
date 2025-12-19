import { useCallback, useMemo, useEffect, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Controls,
  useReactFlow,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type NodeChange,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import { toPng } from 'html-to-image';
import { Link2, Link2Off, Camera } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useGenerationStore } from '../../store/generationStore';
import { useProjectStore } from '../../store/projectStore';
import { groupConnectionsByKey, generateConnectionColors } from '../../lib/sharedStore';
import { ComponentNode, type ComponentNodeData } from './ComponentNode';

// Register custom node types - must be outside component to prevent re-renders
const nodeTypes = {
  component: ComponentNode,
};

function DragDropCanvasInner() {
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const { currentProject } = useProjectStore();
  const {
    canvasComponents,
    selectedComponentId,
    setSelectedComponentId,
    updateSize,
    clearSize,
    updatePosition,
    addToCanvas,
    removeFromCanvas,
    stateConnections,
    showConnections,
    toggleShowConnections,
  } = useCanvasStore();
  const { setGenerationMode, setEditingComponentName, startFixing } = useGenerationStore();

  // ============================================
  // KEYBOARD: Delete key to remove selected items
  // ============================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }

        if (selectedComponentId) {
          e.preventDefault();
          removeFromCanvas(selectedComponentId);
          setSelectedComponentId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponentId, removeFromCanvas, setSelectedComponentId]);

  // ============================================
  // NODES: Zustand → Derived → React Flow State
  // ============================================

  const derivedNodes = useMemo((): Node<ComponentNodeData>[] => {
    if (!currentProject) return [];

    return canvasComponents.map((item) => ({
      id: item.id,
      type: 'component',
      position: { x: item.position.x, y: item.position.y },
      data: {
        componentName: item.componentName,
        projectId: currentProject.id,
        targetSize: item.size,
        onResize: (width: number, height: number) => updateSize(item.id, width, height),
        onFix: (errorMessage: string, errorStack?: string) => {
          startFixing(item.componentName, { message: errorMessage, stack: errorStack });
        },
        onClearSize: () => clearSize(item.id),
      },
      selected: selectedComponentId === item.id,
      ...(item.size && {
        width: item.size.width,
        height: item.size.height,
      }),
    }));
  }, [canvasComponents, currentProject, selectedComponentId, updateSize, startFixing, clearSize]);

  // React Flow local state
  const [nodes, setNodes] = useState<Node<ComponentNodeData>[]>([]);

  // Sync derived nodes → React Flow state
  useEffect(() => {
    setNodes((currentNodes) => {
      const nodeMap = new Map(currentNodes.map((n) => [n.id, n]));

      return derivedNodes.map((derived) => {
        const existing = nodeMap.get(derived.id);
        if (existing) {
          return {
            ...existing,
            position: derived.position,
            data: derived.data,
            selected: derived.selected,
            // Sync width/height for resize support
            width: derived.width,
            height: derived.height,
          };
        }
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

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<ComponentNodeData>>[]) => {
      setNodes((current) => applyNodeChanges(changes, current));

      changes.forEach((change) => {
        if (change.type === 'select') {
          if (change.selected) {
            setSelectedComponentId(change.id);
          } else if (selectedComponentId === change.id) {
            setSelectedComponentId(null);
          }
        }
      });
    },
    [setSelectedComponentId, selectedComponentId]
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      updatePosition(node.id, node.position.x, node.position.y);
    },
    [updatePosition]
  );

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
  // DEBUG: Image export and state exposure
  // ============================================

  const downloadImage = useCallback(async () => {
    const flowNodes = getNodes();
    if (flowNodes.length === 0) return;

    const nodesBounds = getNodesBounds(flowNodes);
    const viewport = getViewportForBounds(nodesBounds, 1200, 800, 0.5, 2, 0.2);

    const element = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!element) return;

    try {
      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        width: 1200,
        height: 800,
        style: {
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      const link = document.createElement('a');
      link.download = `canvas-${currentProject?.id || 'export'}.png`;
      link.href = dataUrl;
      link.click();
      console.log('[Canvas] Image exported');
    } catch (err) {
      console.error('[Canvas] Failed to export image:', err);
    }
  }, [getNodes, currentProject]);

  // Expose debug state to window for Playwright/console access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__CANVAS_DEBUG__ = {
        nodes,
        edges,
        canvasComponents,
        downloadImage,
        currentProject,
      };
    }
  }, [nodes, edges, canvasComponents, downloadImage, currentProject]);

  // ============================================
  // RENDER
  // ============================================

  const hasConnections = stateConnections.length > 0;
  const hasContent = canvasComponents.length > 0;

  return (
    <div className="h-full w-full relative" data-canvas="true">
      {!hasContent ? (
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
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          nodesDraggable={true}
          multiSelectionKeyCode={null}
          selectionOnDrag={false}
          fitView={false}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          zoomOnDoubleClick={false}
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

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 z-50 flex gap-2">
        {hasContent && (
          <button
            onClick={downloadImage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors shadow-sm bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
            title="Export canvas as image"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        )}
        {hasConnections && (
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
        )}
      </div>
    </div>
  );
}

export function DragDropCanvas() {
  return (
    <ReactFlowProvider>
      <DragDropCanvasInner />
    </ReactFlowProvider>
  );
}
