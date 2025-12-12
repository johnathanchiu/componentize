import { useState, useRef } from 'react';
import { Zap, Plus } from 'lucide-react';
import type { Interaction } from '../../types/index';
import { EditComponentForm } from './EditComponentForm';
import { ViewCodeSection } from './ViewCodeSection';
import { AddInteractionForm } from './AddInteractionForm';
import { InteractionsList } from './InteractionsList';

interface InteractionPanelProps {
  componentId: string;
  componentName: string;
  interactions?: Interaction[];
}

export function InteractionPanel({ componentId, componentName, interactions = [] }: InteractionPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const viewCodeRef = useRef<{ refresh: () => void }>(null);

  const handleEditSuccess = () => {
    viewCodeRef.current?.refresh();
  };

  return (
    <div className="absolute -right-2 top-full mt-2 w-80 bg-white border-2 border-purple-500 rounded-lg shadow-xl z-50 max-h-[500px] overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 bg-purple-50 border-b border-purple-200 flex items-center gap-2 sticky top-0 z-10">
        <Zap className="w-4 h-4 text-purple-600" />
        <h3 className="text-sm font-semibold text-gray-900">Component Controls</h3>
        <span className="text-xs text-gray-500">({componentName})</span>
      </div>

      {/* Edit Component Section */}
      <EditComponentForm
        componentName={componentName}
        onSuccess={handleEditSuccess}
      />

      {/* View Code Section */}
      <ViewCodeSection componentName={componentName} />

      {/* Interactions Section Header */}
      <div className="px-3 py-2 bg-gray-50">
        <h4 className="text-xs font-semibold text-gray-700">Interactions</h4>
      </div>

      {/* Existing Interactions */}
      <div className="p-3 max-h-60 overflow-y-auto">
        {!showAddForm && interactions.length === 0 && (
          <div className="text-center py-4 text-sm text-gray-400">
            No interactions yet
          </div>
        )}

        {interactions.length > 0 && (
          <InteractionsList
            componentId={componentId}
            interactions={interactions}
          />
        )}

        {/* Add Form */}
        {showAddForm && (
          <AddInteractionForm
            componentId={componentId}
            componentName={componentName}
            onClose={() => setShowAddForm(false)}
          />
        )}
      </div>

      {/* Add Button */}
      {!showAddForm && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full px-3 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Interaction
          </button>
        </div>
      )}
    </div>
  );
}
