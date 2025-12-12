import { useState } from 'react';
import { Trash2, Code2 } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import type { Interaction } from '../../types/index';

interface InteractionsListProps {
  componentId: string;
  interactions: Interaction[];
}

export function InteractionsList({ componentId, interactions }: InteractionsListProps) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const { removeInteraction } = useCanvasStore();

  const handleDelete = (interactionId: string) => {
    removeInteraction(componentId, interactionId);
  };

  if (interactions.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-gray-400">
        No interactions yet
      </div>
    );
  }

  return (
    <>
      {interactions.map((interaction) => (
        <div
          key={interaction.id}
          className="mb-2 p-3 bg-gray-50 border border-gray-200 rounded-md group"
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                  {interaction.type}
                </span>
                <button
                  onClick={() => handleDelete(interaction.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3 text-red-600" />
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">{interaction.description}</p>
            </div>
          </div>

          <button
            onClick={() => setExpandedCode(expandedCode === interaction.id ? null : interaction.id)}
            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 mt-2"
          >
            <Code2 className="w-3 h-3" />
            {expandedCode === interaction.id ? 'Hide code' : 'Show code'}
          </button>

          {expandedCode === interaction.id && (
            <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-x-auto">
              {interaction.code}
            </pre>
          )}
        </div>
      ))}
    </>
  );
}
