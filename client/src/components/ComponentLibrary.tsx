import { useEffect } from 'react';
import { RefreshCw, GripVertical, Pencil } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { listComponents } from '../lib/api';
import { useCanvasStore } from '../store/canvasStore';

interface DraggableComponentProps {
  name: string;
  onEdit: () => void;
}

function DraggableComponent({ name, onEdit }: DraggableComponentProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${name}`,
    data: { componentName: name, source: 'library' },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition-colors cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 bg-neutral-100' : ''
      }`}
    >
      {/* Drag indicator */}
      <GripVertical className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-400 transition-colors flex-shrink-0" />

      {/* Component name */}
      <span className="font-medium flex-1">{name}</span>

      {/* Edit button - stops propagation to prevent drag */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-neutral-200 rounded transition-all"
        title={`Edit ${name}`}
      >
        <Pencil className="w-3.5 h-3.5 text-neutral-500" />
      </button>
    </div>
  );
}

export function ComponentLibrary() {
  const { availableComponents, setAvailableComponents, startEditing } = useCanvasStore();

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Components</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {availableComponents.length} available
          </p>
        </div>
        <button
          onClick={loadComponents}
          className="p-1.5 hover:bg-neutral-100 rounded-md transition-colors"
          title="Refresh components"
        >
          <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-2">
        {availableComponents.length === 0 ? (
          <div className="text-sm text-neutral-400 text-center py-12 px-4">
            <p>No components yet</p>
            <p className="text-xs mt-1">
              Use the prompt below to generate your first component
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {availableComponents.map((component) => (
              <DraggableComponent
                key={component.name}
                name={component.name}
                onEdit={() => startEditing(component.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
