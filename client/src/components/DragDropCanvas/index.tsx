import { useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useCanvasStore } from '../../store/canvasStore';
import { useGenerationStore } from '../../store/generationStore';
import { useProjectStore } from '../../store/projectStore';
import { detectStateConnections } from '../../lib/sharedStore';
import { ConnectionsOverlay, ConnectionsLegend, ConnectionsToggle } from '../ConnectionsOverlay';
import { CanvasItem } from './CanvasItem';

interface DragDropCanvasProps {
  cmdKeyHeld: boolean;
}

export function DragDropCanvas({ cmdKeyHeld }: DragDropCanvasProps) {
  const { setNodeRef } = useDroppable({ id: 'canvas' });

  const { currentProject } = useProjectStore();
  const {
    canvasComponents,
    selectedComponentId,
    setSelectedComponentId,
    updateSize,
    stateConnections,
    showConnections,
    addStateConnections,
    removeComponentConnections,
  } = useCanvasStore();
  const { startFixing, setGenerationMode, setEditingComponentName } = useGenerationStore();

  const handleFix = (componentName: string, errorMessage: string, errorStack?: string) => {
    startFixing(componentName, { message: errorMessage, stack: errorStack });
  };

  const createConnectionsCallback = useCallback(
    (componentId: string, componentName: string) => {
      return (source: string) => {
        const connections = detectStateConnections(source, componentId, componentName);
        if (connections.length > 0) {
          addStateConnections(connections);
        } else {
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
        onClick={() => {
          setSelectedComponentId(null);
          setEditingComponentName(null);
          setGenerationMode('create');
        }}
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
              onResize={(width, height) => updateSize(item.id, width, height)}
              onFix={(errorMessage, errorStack) => handleFix(item.componentName, errorMessage, errorStack)}
              onConnectionsDetected={createConnectionsCallback(item.id, item.componentName)}
              cmdKeyHeld={cmdKeyHeld}
            />
          ))
        ) : null}

        <ConnectionsOverlay connections={stateConnections} visible={showConnections} />
        <ConnectionsLegend />
      </div>

      <div className="absolute top-3 right-3 z-50">
        <ConnectionsToggle />
      </div>
    </div>
  );
}
