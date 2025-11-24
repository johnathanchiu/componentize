import { useDroppable } from '@dnd-kit/core';
import { Trash2, AlertCircle, Wrench } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import { InteractionPanel } from './InteractionPanel';
import { Resizable } from 're-resizable';
import type { Size } from '../types/index';
import { useEffect, useState, useRef } from 'react';
import { editComponent } from '../lib/api';

interface CanvasItemProps {
  id: string;
  componentName: string;
  x: number;
  y: number;
  size?: Size;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onResize: (width: number, height: number) => void;
  interactions?: any[];
}

function CanvasItem({ id, componentName, x, y, size, isSelected, onSelect, onDelete, onResize, interactions }: CanvasItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas-${id}`,
    data: { id, componentName, source: 'canvas' },
  });

  const [componentError, setComponentError] = useState<{ message: string; stack?: string } | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  const handleFixErrors = async () => {
    if (!componentError) return;

    setIsFixing(true);
    setFixProgress('Connecting to AI...');

    try {
      const errorDescription = `Fix this error in the component:\n\nError: ${componentError.message}\n\n${componentError.stack ? `Stack: ${componentError.stack}` : ''}`;

      const response = await fetch('http://localhost:5001/api/edit-component-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          componentName,
          editDescription: errorDescription
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress') {
              setFixProgress(data.message);
            } else if (data.type === 'success') {
              setFixProgress(data.message);
              // Reload iframe to show fixed component
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src;
              }
              setComponentError(null);
              setTimeout(() => setFixProgress(''), 2000);
            } else if (data.type === 'error') {
              setFixProgress(`Error: ${data.message}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fix errors:', err);
      setFixProgress('Failed to fix errors');
    } finally {
      setIsFixing(false);
    }
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
      {/* Floating delete button - appears on hover, positioned at top right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 p-1.5 bg-red-600 hover:bg-red-700 rounded-full shadow-lg"
        title="Remove component"
      >
        <Trash2 className="w-3.5 h-3.5 text-white" />
      </button>

      <Resizable
        size={defaultSize}
        onResizeStop={(e, direction, ref, d) => {
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
        className={`border-2 rounded-lg shadow-sm ${
          isSelected ? 'border-purple-500' : 'border-gray-300'
        } hover:border-purple-400 transition-colors relative overflow-hidden`}
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
          <div className="px-2 py-1 bg-purple-600 text-white text-xs font-medium">
            {componentName}
          </div>
        </div>

        {/* Iframe rendering the actual component */}
        <iframe
          ref={iframeRef}
          src={`http://localhost:5001/preview/${componentName}`}
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

            {/* Progress indicator */}
            {isFixing && fixProgress && (
              <div className="mb-3 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800 max-w-full">
                {fixProgress}
              </div>
            )}

            <button
              onClick={handleFixErrors}
              disabled={isFixing}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 pointer-events-auto"
            >
              <Wrench className={`w-4 h-4 ${isFixing ? 'animate-spin' : ''}`} />
              {isFixing ? 'Fixing...' : 'Fix with AI'}
            </button>
          </div>
        )}

        {/* Interaction count badge - positioned at bottom */}
        {interactions && interactions.length > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-purple-600 text-white text-xs rounded-md shadow-sm pointer-events-none z-20">
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
  } = useCanvasStore();

  return (
    <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center px-4">
        <h2 className="text-sm font-semibold text-gray-700">Canvas</h2>
        <div className="ml-auto text-xs text-gray-500">
          {canvasComponents.length} component{canvasComponents.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className="relative w-full h-[calc(100%-3rem)] bg-gray-50 overflow-auto"
        onClick={() => setSelectedComponentId(null)}
      >
        {canvasComponents.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-lg mb-1">Drop components here</div>
              <div className="text-sm">Drag from the component library to start building</div>
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
              onDelete={() => removeFromCanvas(item.id)}
              onResize={(width, height) => updateSize(item.id, width, height)}
              interactions={item.interactions}
            />
          ))
        )}
      </div>
    </div>
  );
}
