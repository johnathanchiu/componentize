import { useDroppable } from '@dnd-kit/core';
import { Trash2, AlertCircle, Wrench, Pencil, GripHorizontal } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { useProjectStore } from '../store/projectStore';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import { InteractionPanel } from './InteractionPanel';
import { Resizable } from 're-resizable';
import type { Size } from '../types/index';
import { useEffect, useState, useRef } from 'react';

// Vite dev server port (always 5100 for shared workspace)
const VITE_SERVER_PORT = 5100;

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
  interactions?: any[];
}

function CanvasItem({ id, componentName, projectId, x, y, size, isSelected, onSelect, onEdit, onDelete, onResize, onFix, interactions }: CanvasItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas-${id}`,
    data: { id, componentName, source: 'canvas' },
  });

  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isGenerating, generationMode, editingComponentName, componentVersions } = useCanvasStore();

  // Get version for this component (used to bust iframe cache)
  const componentVersion = componentVersions[componentName] || 0;

  // Preview URL uses Vite dev server with project and component params
  const previewUrl = `http://localhost:${VITE_SERVER_PORT}/?project=${projectId}&component=${componentName}&v=${componentVersion}`;

  // Track if this component is currently being fixed
  const isBeingFixed = generationMode === 'fix' && editingComponentName === componentName && isGenerating;

  // Listen for messages from iframe (errors, loads, and size reports)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.componentName !== componentName) return;

      if (event.data.type === 'COMPONENT_ERROR') {
        setComponentError(event.data.error);
      } else if (event.data.type === 'COMPONENT_LOADED') {
        setComponentError(null);
      } else if (event.data.type === 'COMPONENT_SIZE') {
        // Capture the component's natural size
        const { width, height } = event.data.size;
        setNaturalSize({ width, height });
        // Also update the store if no size was set yet (initial placement)
        if (!size) {
          onResize(width, height);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [componentName, size, onResize]);

  // Clear error and reset natural size when component version changes
  useEffect(() => {
    setComponentError(null);
    setNaturalSize(null);
  }, [componentVersion]);

  const handleFixErrors = () => {
    if (!componentError) return;
    onFix(componentError.message, componentError.stack);
  };

  // Use stored size (user resized), or natural size, or fallback
  const displaySize = size || naturalSize || { width: 120, height: 40 };

  // Calculate scale factor for when user has resized the component
  // We use uniform scaling based on width to maintain aspect ratio
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
      ref={setNodeRef}
      style={style}
      className={`group ${isDragging ? 'opacity-50 z-50' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Floating action buttons - appear on hover */}
      <div className="absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 flex gap-1 items-center">
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
        {/* Iframe wrapper - clips overflow when scaling */}
        <div className="w-full h-full overflow-hidden">
          {/* Iframe renders at natural size, scaled to fit container */}
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="border-none bg-transparent"
            style={{
              width: naturalSize?.width || '100%',
              height: naturalSize?.height || '100%',
              transformOrigin: 'top left',
              transform: scale !== 1 ? `scale(${scale})` : undefined,
            }}
            sandbox="allow-scripts"
            title={`Preview of ${componentName}`}
          />
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

      {/* Interaction count badge */}
      {interactions && interactions.length > 0 && (
        <div className="absolute -bottom-5 left-0 px-1.5 py-0.5 bg-neutral-600 text-white text-[9px] rounded shadow-sm pointer-events-none z-20">
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
              interactions={item.interactions}
            />
          ))
        ) : null}
      </div>
    </div>
  );
}
