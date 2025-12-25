import { useEffect } from 'react';
import { RefreshCw, Wrench } from 'lucide-react';
import { ComponentCard } from './ComponentCard';
import { useLibrary } from '@/hooks/useLibrary';
import { useCurrentProject, useAvailableComponents } from '@/store/projectStore';
import { useIsGenerating } from '@/store/generationStore';

export function LibraryPanel() {
  // Use typed selector hooks for optimal re-rendering
  const currentProject = useCurrentProject();
  const availableComponents = useAvailableComponents();
  const isGenerating = useIsGenerating();
  const {
    brokenCount,
    refresh,
    deleteComponent,
    fixAll,
    reportError,
    reportSuccess,
  } = useLibrary();

  // Load components on mount and project change
  useEffect(() => {
    refresh();
  }, [currentProject?.id, refresh]);

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-400">
        <p className="text-sm">No project selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with refresh and Fix All */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100">
        <span className="text-xs text-neutral-500">
          {availableComponents.length} component{availableComponents.length !== 1 ? 's' : ''}
          {brokenCount > 0 && (
            <span className="ml-1 text-red-500">({brokenCount} broken)</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {brokenCount > 0 && (
            <button
              onClick={fixAll}
              disabled={isGenerating}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Fix all ${brokenCount} broken component${brokenCount !== 1 ? 's' : ''}`}
            >
              <Wrench className="w-3 h-3" />
              Fix All
            </button>
          )}
          <button
            onClick={refresh}
            className="p-1 hover:bg-neutral-100 rounded transition-colors"
            title="Refresh components"
          >
            <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {availableComponents.map((component) => (
          <ComponentCard
            key={component.name}
            name={component.name}
            projectId={currentProject.id}
            onDelete={() => deleteComponent(component.name)}
            onError={reportError}
            onSuccess={reportSuccess}
          />
        ))}

        {availableComponents.length === 0 && (
          <div className="text-center text-neutral-400 py-8">
            <p className="text-sm">No components yet</p>
            <p className="text-xs mt-1">Switch to Create tab to make one</p>
          </div>
        )}
      </div>
    </div>
  );
}
