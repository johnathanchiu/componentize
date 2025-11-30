import { useDroppable } from '@dnd-kit/core';
import { Trash2, AlertCircle, Wrench, Pencil } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import { InteractionPanel } from './InteractionPanel';
import { Resizable } from 're-resizable';
import type { Size } from '../types/index';
import { useEffect, useState, useRef } from 'react';
import { config } from '../config';

interface CanvasItemProps {
  id: string;
  componentName: string;
  x: number;
  y: number;
  size?: Size;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onResize: (width: number, height: number) => void;
  onFix: (errorMessage: string, errorStack?: string) => void;
  interactions?: any[];
}

function CanvasItem({ id, componentName, x, y, size, isSelected, onSelect, onEdit, onDelete, onResize, onFix, interactions }: CanvasItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas-${id}`,
    data: { id, componentName, source: 'canvas' },
  });

  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isGenerating, generationMode, editingComponentName, componentVersions } = useCanvasStore();

  // Get version for this component (used to bust iframe cache)
  const componentVersion = componentVersions[componentName] || 0;

  // Track if this component is currently being fixed
  const isBeingFixed = generationMode === 'fix' && editingComponentName === componentName && isGenerating;

  // Listen for error messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'COMPONENT_ERROR' && event.data.componentName === componentName) {
        setComponentError(event.data.error);
      } else if (event.data.type === 'COMPONENT_LOADED' && event.data.componentName === componentName) {
        setComponentError(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [componentName]);

  // Clear error when component version changes (successful edit/fix)
  useEffect(() => {
    setComponentError(null);
  }, [componentVersion]);

  const handleFixErrors = () => {
    if (!componentError) return;
    onFix(componentError.message, componentError.stack);
  };

  const style = {
    position: 'absolute' as const,
    left: x,
    top: y,
    transform: transform && !isDragging ? CSS.Transform.toString(transform) : undefined,
  };

  const defaultSize = size || { width: 200, height: 100 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group ${isDragging ? 'opacity-70' : ''}`}
      onClick={onSelect}
    >
      {/* Floating action buttons - appear on hover */}
      <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 flex gap-1">
        {/* Edit button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg"
          title="Edit component"
        >
          <Pencil className="w-3.5 h-3.5 text-white" />
        </button>
        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 bg-red-600 hover:bg-red-700 rounded-full shadow-lg"
          title="Remove component"
        >
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      </div>

      <Resizable
        size={defaultSize}
        onResizeStop={(_e, _direction, _ref, d) => {
          const newWidth = defaultSize.width + d.width;
          const newHeight = defaultSize.height + d.height;
          onResize(newWidth, newHeight);
        }}
        minWidth={100}
        minHeight={60}
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
        handleClasses={{
          bottomRight: 'resize-handle resize-handle-corner',
        }}
        className={`border-2 rounded-lg shadow-sm bg-white ${
          isSelected ? 'border-neutral-900' : 'border-neutral-200'
        } hover:border-neutral-400 transition-colors relative overflow-hidden`}
      >
        {/* Draggable border overlay - appears on hover over edges */}
        <div
          {...listeners}
          {...attributes}
          className="absolute inset-0 pointer-events-none z-10"
        >
          {/* Top edge */}
          <div className="absolute top-0 left-0 right-0 h-3 pointer-events-auto cursor-move opacity-0 group-hover:opacity-100" />
          {/* Right edge - exclude bottom-right corner for resize handle */}
          <div className="absolute top-0 right-0 bottom-12 w-3 pointer-events-auto cursor-move opacity-0 group-hover:opacity-100" />
          {/* Bottom edge - exclude bottom-right corner for resize handle */}
          <div className="absolute bottom-0 left-0 right-12 h-3 pointer-events-auto cursor-move opacity-0 group-hover:opacity-100" />
          {/* Left edge */}
          <div className="absolute top-0 left-0 bottom-0 w-3 pointer-events-auto cursor-move opacity-0 group-hover:opacity-100" />
        </div>

        {/* Component name label - shows on hover */}
        <div className="absolute top-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
          <div className="px-2 py-1 bg-neutral-900 text-white text-xs font-medium">
            {componentName}
          </div>
        </div>

        {/* Iframe rendering the actual component */}
        <iframe
          ref={iframeRef}
          src={`${config.apiBaseUrl}/preview/${componentName}?v=${componentVersion}`}
          className="w-full h-full border-none pointer-events-auto"
          sandbox="allow-scripts"
          title={`Preview of ${componentName}`}
        />

        {/* Error overlay */}
        {componentError && (
          <div className="absolute inset-0 bg-red-50 bg-opacity-95 flex flex-col items-center justify-center p-4 z-20 pointer-events-none">
            <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
            <div className="text-sm font-semibold text-red-900 mb-1">Component Error</div>
            <div className="text-xs text-red-700 text-center mb-3 max-w-full overflow-hidden">
              {componentError.message}
            </div>

            {/* Progress indicator - now shown in the bottom panel */}
            {isBeingFixed && (
              <div className="mb-3 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800 max-w-full">
                Fixing in progress... (see bottom panel)
              </div>
            )}

            <button
              onClick={handleFixErrors}
              disabled={isBeingFixed}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 pointer-events-auto"
            >
              <Wrench className={`w-4 h-4 ${isBeingFixed ? 'animate-spin' : ''}`} />
              {isBeingFixed ? 'Fixing...' : 'Fix with AI'}
            </button>
          </div>
        )}

        {/* Interaction count badge - positioned at bottom */}
        {interactions && interactions.length > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-neutral-700 text-white text-xs rounded-md shadow-sm pointer-events-none z-20">
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
      </Resizable>
    </div>
  );
}

export function DragDropCanvas() {
  const { setNodeRef } = useDroppable({
    id: 'canvas',
  });

  const {
    canvasComponents,
    selectedComponentId,
    setSelectedComponentId,
    removeFromCanvas,
    updateSize,
    startFixing,
    startEditing,
  } = useCanvasStore();

  // Handler to start fixing a component with an error - auto-triggers fix
  const handleFix = (componentName: string, errorMessage: string, errorStack?: string) => {
    startFixing(componentName, { message: errorMessage, stack: errorStack });
  };

  // Handler to start editing a component
  const handleEdit = (componentName: string) => {
    startEditing(componentName);
  };

  return (
    <div className="h-full overflow-hidden">
      <div
        ref={setNodeRef}
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
        ) : (
          canvasComponents.map((item) => (
            <CanvasItem
              key={item.id}
              id={item.id}
              componentName={item.componentName}
              x={item.position.x}
              y={item.position.y}
              size={item.size}
              isSelected={selectedComponentId === item.id}
              onSelect={() => setSelectedComponentId(item.id)}
              onEdit={() => handleEdit(item.componentName)}
              onDelete={() => removeFromCanvas(item.id)}
              onResize={(width, height) => updateSize(item.id, width, height)}
              onFix={(errorMessage, errorStack) => handleFix(item.componentName, errorMessage, errorStack)}
              interactions={item.interactions}
            />
          ))
        )}
      </div>
    </div>
  );
}
