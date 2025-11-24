import { useEffect } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { listComponents } from '../lib/api';
import { useCanvasStore } from '../store/canvasStore';

interface DraggableComponentProps {
  name: string;
}

function DraggableComponent({ name }: DraggableComponentProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${name}`,
    data: { componentName: name, source: 'library' },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-medium text-gray-700 cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {name}
    </div>
  );
}

export function ComponentLibrary() {
  const { availableComponents, setAvailableComponents } = useCanvasStore();

  const loadComponents = async () => {
    try {
      const result = await listComponents();
      if (result.status === 'success' && result.components) {
        setAvailableComponents(result.components);
      }
    } catch (err) {
      console.error('Failed to load components:', err);
    }
  };

  useEffect(() => {
    loadComponents();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Components</h2>
        </div>
        <button
          onClick={loadComponents}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="text-xs text-gray-500 mb-3">
        Drag components to the canvas
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {availableComponents.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-8">
            No components yet.
            <br />
            Generate your first component above!
          </div>
        ) : (
          availableComponents.map((component) => (
            <DraggableComponent key={component.name} name={component.name} />
          ))
        )}
      </div>
    </div>
  );
}
