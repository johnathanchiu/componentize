import { Trash2, Pencil, GripHorizontal } from 'lucide-react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

interface ControlPosition {
  vertical: 'top' | 'bottom';
  horizontal: 'left' | 'outsideLeft' | 'outsideRight';
}

interface CanvasItemToolbarProps {
  componentName: string;
  controlPosition: ControlPosition;
  onEdit: () => void;
  onDelete: () => void;
  listeners?: SyntheticListenerMap;
  attributes?: DraggableAttributes;
}

export function CanvasItemToolbar({
  componentName,
  controlPosition,
  onEdit,
  onDelete,
  listeners,
  attributes,
}: CanvasItemToolbarProps) {
  return (
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
  );
}
