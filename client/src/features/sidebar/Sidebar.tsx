import { useState, useEffect } from 'react';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import { ResizeHandle } from '../../components/ResizeHandle';
import { PromptForm } from '../generation/PromptForm';
import { LibraryPanel } from '../library/LibraryPanel';
import { useGenerationMode } from '../generation/generationStore';
import { useCurrentProject } from '../../store/projectStore';

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('library');
  // Use typed selector hooks for optimal re-rendering
  const generationMode = useGenerationMode();
  const currentProject = useCurrentProject();

  const { panelSize, isResizing, handleMouseDown } = useResizablePanel({
    storageKey: 'left-panel-width',
    direction: 'horizontal',
    defaultSize: 288,
    minSize: 200,
    maxSize: 500,
    resizeFrom: 'right',
  });

  // Auto-switch to Create tab when editing/fixing
  useEffect(() => {
    if (generationMode === 'edit' || generationMode === 'fix') {
      setActiveTab('create');
    }
  }, [generationMode]);

  // Auto-switch to Create tab when there's a pending prompt
  useEffect(() => {
    const pendingPrompt = sessionStorage.getItem('pendingPrompt');
    if (pendingPrompt && currentProject) {
      setActiveTab('create');
    }
  }, [currentProject?.id]);

  return (
    <div
      className="relative border-r border-neutral-200 bg-white flex flex-col h-full"
      style={{ width: panelSize }}
    >
      {/* Tab headers */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'create'
              ? 'text-neutral-900 border-b-2 border-neutral-900'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Create
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'library'
              ? 'text-neutral-900 border-b-2 border-neutral-900'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Library
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'create' ? <PromptForm /> : <LibraryPanel />}
      </div>

      {/* Resize handle */}
      <ResizeHandle
        isResizing={isResizing}
        onMouseDown={handleMouseDown}
        direction="horizontal"
        position="right"
      />
    </div>
  );
}
