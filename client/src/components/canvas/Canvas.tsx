import { useCallback, useMemo, useEffect, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  useReactFlow,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type NodeChange,
  type Edge,
} from '@xyflow/react';
import { toPng } from 'html-to-image';
import { Link2, Link2Off, Camera } from 'lucide-react';
import {
  useCanvasComponents,
  useSelectedId,
  useConnections,
  useShowConnections,
  useCanvasActions,
} from '@/store/canvasStore';
import { useCanvasKeyboard } from '@/hooks/useKeyboard';
import { useGenerationActions } from '@/store/generationStore';
import { useCurrentProject } from '@/store/projectStore';
import { usePageStyle } from '@/store/layoutStore';
import { groupConnectionsByKey, generateConnectionColors } from '@/lib/sharedStore';
import { ComponentNode, type ComponentNodeData } from './ComponentNode';
import { PAGE_WIDTHS, type PageWidthPreset } from '@/types/index';

// Helper to get page width from pageStyle
function getPageWidth(width: number | PageWidthPreset | undefined): number {
  if (!width) return PAGE_WIDTHS.desktop;
  if (typeof width === 'number') return width;
  return PAGE_WIDTHS[width] || PAGE_WIDTHS.desktop;
}

// Artboard node - renders the page background
function ArtboardNode({ data }: { data: { width: number; height: number; background: string } }) {
  return (
    <div
      className="shadow-2xl"
      style={{
        width: data.width,
        height: data.height,
        background: data.background,
        pointerEvents: 'none',
      }}
    />
  );
}

// Register custom node types
const nodeTypes = {
  component: ComponentNode,
  artboard: ArtboardNode,
};

function CanvasInner() {
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const currentProject = useCurrentProject();
  const pageStyle = usePageStyle();
  const { isDragModeActive } = useCanvasKeyboard();

  // Use typed selector hooks for optimal re-rendering
  const { setGenerationMode, setEditingComponentName, startFixing } = useGenerationActions();

  // Canvas state via typed selector hooks
  const components = useCanvasComponents();
  const selectedId = useSelectedId();
  const connections = useConnections();
  const showConnections = useShowConnections();

  const {
    select,
    updatePosition,
    add,
    toggleConnections,
    pushToHistory,
  } = useCanvasActions();

  // Page artboard dimensions - prefer layoutStore pageStyle, fallback to project pageStyle
  const pageWidth = getPageWidth(pageStyle?.width ?? currentProject?.pageStyle?.width);
  const pageBackground = pageStyle?.background ?? currentProject?.pageStyle?.background ?? '#ffffff';

  // Derive ReactFlow nodes from canvas components
  const derivedNodes = useMemo((): Node<ComponentNodeData | { width: number; height: number; background: string }>[] => {
    if (!currentProject) return [];

    // Component nodes
    const componentNodes = components.map((item) => ({
      id: item.id,
      type: 'component' as const,
      position: { x: item.position.x, y: item.position.y },
      data: {
        componentName: item.componentName,
        projectId: currentProject.id,
        targetSize: item.size,
        onFix: (errorMessage: string, errorStack?: string) => {
          startFixing(item.componentName, { message: errorMessage, stack: errorStack });
        },
      },
      selected: selectedId === item.id,
      zIndex: 10,
      ...(item.size && {
        width: item.size.width,
        height: item.size.height,
      }),
    }));

    // Calculate artboard height from component bounds
    let artboardHeight = 800;
    if (componentNodes.length > 0) {
      const maxY = Math.max(...componentNodes.map((n) => n.position.y + (n.height || 200)));
      artboardHeight = Math.max(800, maxY + 100);
    }

    // Artboard node at (0,0)
    const artboardNode: Node<{ width: number; height: number; background: string }> = {
      id: '__artboard__',
      type: 'artboard',
      position: { x: 0, y: 0 },
      data: {
        width: pageWidth,
        height: artboardHeight,
        background: pageBackground,
      },
      selectable: false,
      draggable: false,
      zIndex: 0,
    };

    return [artboardNode, ...componentNodes];
  }, [components, currentProject, selectedId, startFixing, pageWidth, pageBackground]);

  // ReactFlow local state
  const [nodes, setNodes] = useState<Node<any>[]>([]);

  // Sync derived nodes → ReactFlow state
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
            width: derived.width,
            height: derived.height,
          };
        }
        return derived;
      });
    });
  }, [derivedNodes]);

  // Derive edges from state connections
  const edges = useMemo((): Edge[] => {
    if (!showConnections || connections.length === 0) return [];

    const grouped = groupConnectionsByKey(connections);
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
  }, [connections, showConnections]);

  // Event handlers
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<ComponentNodeData>>[]) => {
      setNodes((current) => applyNodeChanges(changes, current));

      changes.forEach((change) => {
        if (change.type === 'select') {
          if (change.selected) {
            select(change.id);
          } else if (selectedId === change.id) {
            select(null);
          }
        }
      });
    },
    [select, selectedId]
  );

  const handleNodeDragStart = useCallback(() => {
    pushToHistory();
  }, [pushToHistory]);

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      updatePosition(node.id, node.position.x, node.position.y);
    },
    [updatePosition]
  );

  const handlePaneClick = useCallback(() => {
    select(null);
    setEditingComponentName(null);
    setGenerationMode('create');
  }, [select, setEditingComponentName, setGenerationMode]);

  // Drag & drop from library
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

      add({
        id: `${componentName}-${Date.now()}`,
        componentName,
        position: { x: position.x, y: position.y },
      });
    },
    [screenToFlowPosition, add]
  );

  // Image export
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

  // Debug state exposure
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__CANVAS_DEBUG__ = {
        nodes,
        edges,
        components,
        downloadImage,
        currentProject,
      };
    }
  }, [nodes, edges, components, downloadImage, currentProject]);

  const hasConnections = connections.length > 0;
  const hasContent = components.length > 0;

  return (
    <div className="h-full w-full relative bg-neutral-200" data-canvas="true">
      {!hasContent ? (
        <div
          className="h-full flex items-center justify-center"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Empty state artboard preview */}
          <div
            className="flex items-center justify-center shadow-xl rounded-sm"
            style={{
              width: Math.min(pageWidth * 0.5, 600),
              height: 400,
              background: pageBackground,
            }}
          >
            <div className="text-center text-neutral-400">
              <div className="text-base mb-1">Drop components here</div>
              <div className="text-sm">Drag from the library to start building your page</div>
            </div>
          </div>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          nodesDraggable={isDragModeActive}
          multiSelectionKeyCode={null}
          selectionOnDrag={false}
          fitView={false}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 100, y: 50, zoom: 1 }}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#e5e5e5' }}
        >
          <MiniMap
            nodeColor="#a3a3a3"
            nodeStrokeWidth={3}
            maskColor="rgba(229, 229, 229, 0.8)"
            className="!bg-white/90 !border-neutral-300"
            zoomable
            pannable
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      )}

      {/* Drag mode indicator */}
      {isDragModeActive && hasContent && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1.5 rounded-full text-xs font-medium z-50 shadow-sm">
          Drag mode (release Cmd to interact)
        </div>
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
            onClick={toggleConnections}
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

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
