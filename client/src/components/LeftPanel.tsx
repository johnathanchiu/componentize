import { useState, useEffect, useRef } from 'react';
import { Wand2, Loader2, X, Pencil, Wrench, RefreshCw, Trash2 } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { generateProjectComponentStream, editProjectComponentStream, listProjectComponents } from '../lib/api';
import { useCanvasStore } from '../store/canvasStore';
import { useProjectStore } from '../store/projectStore';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { ResizeHandle } from './ResizeHandle';
import { StatusOrb } from './StatusOrb';
import { Timeline } from './Timeline';
import type { Size } from '../types/index';

// Vite dev server port (always 5100 for shared workspace)
const VITE_SERVER_PORT = 5100;

// ============================================
// CreateTab - Component generation/editing
// ============================================

function CreateTab() {
  const [prompt, setPrompt] = useState('');
  const [componentName, setComponentName] = useState('');
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { currentProject } = useProjectStore();
  const {
    isGenerating,
    setIsGenerating,
    addAvailableComponent,
    streamingEvents,
    streamStatus,
    isStreamPanelExpanded,
    currentComponentName,
    generationMode,
    editingComponentName,
    pendingFixError,
    addStreamingEvent,
    clearStreamingEvents,
    setStreamStatus,
    setStreamPanelExpanded,
    setCurrentComponentName,
    setGenerationMode,
    setEditingComponentName,
    setPendingFixError,
    incrementComponentVersion,
  } = useCanvasStore();

  // Reset form when switching modes
  useEffect(() => {
    if (generationMode === 'create') {
      setComponentName('');
      setPrompt('');
    } else if (editingComponentName) {
      setComponentName(editingComponentName);
      setPrompt('');
    }
  }, [generationMode, editingComponentName]);

  // Auto-trigger fix when there's a pending error
  useEffect(() => {
    if (generationMode === 'fix' && pendingFixError && editingComponentName && !isGenerating) {
      runFix(editingComponentName, pendingFixError.message, pendingFixError.stack);
    }
  }, [generationMode, pendingFixError, editingComponentName, isGenerating]);

  // Shared function to handle streaming response
  const handleStreamResponse = async (
    stream: AsyncGenerator<any>,
    targetName: string,
    isCreateMode: boolean
  ) => {
    for await (const event of stream) {
      addStreamingEvent(event);

      if (event.type === 'success') {
        // Increment version to trigger iframe refresh in canvas
        incrementComponentVersion(targetName);

        if (isCreateMode) {
          addAvailableComponent({ name: targetName, filepath: '' });
        }

        // Clear form after delay
        setTimeout(() => {
          setPrompt('');
          if (isCreateMode) {
            setComponentName('');
          }
          // Auto-collapse after success
          setTimeout(() => {
            setStreamPanelExpanded(false);
            if (!isCreateMode) {
              setGenerationMode('create');
              setEditingComponentName(null);
            }
          }, 2000);
        }, 1000);
      } else if (event.type === 'error') {
        setError(event.message);
      }
    }
  };

  // Core function to run a fix operation
  const runFix = async (targetName: string, errorMessage: string, errorStack?: string) => {
    setError('');

    // Add session divider instead of clearing
    addStreamingEvent({
      type: 'session_start',
      message: `Fixing ${targetName}`,
      timestamp: Date.now(),
      data: { mode: 'fix', componentName: targetName },
    });

    setCurrentComponentName(targetName);
    setIsGenerating(true);
    setStreamPanelExpanded(true);
    setStreamStatus('thinking');
    setPendingFixError(null);

    const fixPrompt = `Fix this runtime error in component "${targetName}":

ERROR: ${errorMessage}

${errorStack ? `STACK TRACE:\n${errorStack}\n` : ''}
The error "${errorMessage}" typically means a variable is used but not defined. Common causes:
- Typo in variable name
- Missing import
- Using a type as a value (e.g., "string" instead of "string" type annotation)
- Variable used before declaration

Call read_component to see the code, find the bug, and call update_component with fixed code.`;

    try {
      if (!currentProject) {
        setError('No project selected');
        setStreamStatus('error');
        return;
      }
      const stream = editProjectComponentStream(currentProject.id, targetName, fixPrompt);
      await handleStreamResponse(stream, targetName, false);
    } catch (err) {
      setError('Network error. Make sure the backend server is running.');
      setStreamStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle generate/edit submission
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe what you want');
      return;
    }

    if (generationMode === 'create' && !componentName.trim()) {
      setError('Please provide a component name');
      return;
    }

    if (generationMode === 'create' && !/^[A-Z][a-zA-Z0-9]*$/.test(componentName)) {
      setError('Component name must start with uppercase and contain only letters/numbers');
      return;
    }

    setError('');
    const targetName = generationMode === 'create' ? componentName : editingComponentName!;

    // Add session divider instead of clearing
    const modeLabel = generationMode === 'create' ? 'Creating' : 'Editing';
    addStreamingEvent({
      type: 'session_start',
      message: `${modeLabel} ${targetName}`,
      timestamp: Date.now(),
      data: { mode: generationMode, componentName: targetName },
    });

    setCurrentComponentName(targetName);
    setIsGenerating(true);
    setStreamPanelExpanded(true);
    setStreamStatus('thinking');

    try {
      if (!currentProject) {
        setError('No project selected');
        setStreamStatus('error');
        return;
      }
      const stream = generationMode === 'create'
        ? generateProjectComponentStream(currentProject.id, prompt, targetName)
        : editProjectComponentStream(currentProject.id, targetName, prompt);

      await handleStreamResponse(stream, targetName, generationMode === 'create');
    } catch (err) {
      setError('Network error. Make sure the backend server is running.');
      setStreamStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey && !isGenerating) {
      handleGenerate();
    }
  };

  const handleCancel = () => {
    setGenerationMode('create');
    setEditingComponentName(null);
    setPrompt('');
    setError('');
  };

  // UI helper functions
  const isEditMode = generationMode === 'edit' || generationMode === 'fix';
  const showStreamingArea = isStreamPanelExpanded && (streamingEvents.length > 0 || isGenerating);

  const getModeLabel = () => {
    switch (generationMode) {
      case 'edit': return 'Editing';
      case 'fix': return 'Fixing';
      default: return 'Generating';
    }
  };

  const getModeIcon = () => {
    switch (generationMode) {
      case 'edit': return <Pencil className="w-4 h-4" />;
      case 'fix': return <Wrench className="w-4 h-4" />;
      default: return <Wand2 className="w-4 h-4" />;
    }
  };

  const getButtonLabel = () => {
    if (isGenerating) {
      return generationMode === 'create' ? 'Generating...' : 'Updating...';
    }
    return generationMode === 'create' ? 'Generate' : 'Update';
  };

  const getPlaceholder = () => {
    if (generationMode === 'edit') {
      return `Describe changes...`;
    }
    return 'Describe your component...';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Streaming area - fills available space */}
      {showStreamingArea ? (
        <div className="flex-1 min-h-0 flex flex-col border-b border-neutral-100">
          <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <StatusOrb status={streamStatus} />
              <span className="text-xs font-medium text-neutral-700">
                {streamStatus === 'success'
                  ? `${currentComponentName} ${generationMode === 'create' ? 'created' : 'updated'}!`
                  : streamStatus === 'error'
                  ? `${getModeLabel()} failed`
                  : `${getModeLabel()} ${currentComponentName}...`}
              </span>
            </div>
            {!isGenerating && streamingEvents.length > 0 && (
              <button
                onClick={clearStreamingEvents}
                className="p-1 hover:bg-neutral-200 rounded transition-colors"
                title="Clear history"
              >
                <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            <Timeline events={streamingEvents} />
          </div>

          {isEditMode && (
            <iframe
              ref={iframeRef}
              className="hidden"
              title="Component reload trigger"
            />
          )}
        </div>
      ) : (
        /* Spacer to push form to bottom when no streaming */
        <div className="flex-1" />
      )}

      {/* Form area - at bottom */}
      <div className="p-3 border-t border-neutral-100">
        {/* Edit mode indicator */}
        {isEditMode && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-purple-50 rounded-lg">
            {getModeIcon()}
            <span className="text-sm text-purple-700 font-medium flex-1 truncate">
              {generationMode === 'edit' ? 'Editing' : 'Fixing'}: {editingComponentName}
            </span>
            <button
              onClick={handleCancel}
              className="p-0.5 text-purple-400 hover:text-purple-600 transition-colors"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Component name (create mode only) */}
        {generationMode === 'create' && (
          <input
            type="text"
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ComponentName"
            className="w-full px-3 py-2 mb-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
            disabled={isGenerating}
          />
        )}

        {/* Prompt textarea - only show when not in fix mode */}
        {generationMode !== 'fix' && (
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
            rows={3}
            disabled={isGenerating}
          />
        )}

        {/* Generate button */}
        {generationMode !== 'fix' && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || (generationMode === 'create' && !componentName.trim())}
            className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              isEditMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-neutral-900 hover:bg-neutral-800'
            }`}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              getModeIcon()
            )}
            <span>{getButtonLabel()}</span>
          </button>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// LibraryTab - Component library with previews
// ============================================

function DraggableComponentCard({ name, projectId }: { name: string; projectId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${name}`,
    data: { componentName: name, source: 'library' },
  });
  const { componentVersions } = useCanvasStore();
  const componentVersion = componentVersions[name] || 0;
  const [previewSize, setPreviewSize] = useState<Size | null>(null);

  // Preview URL uses Vite dev server with project and component params
  const previewUrl = `http://localhost:${VITE_SERVER_PORT}/?project=${projectId}&component=${name}&v=${componentVersion}`;

  // Listen for COMPONENT_SIZE messages to auto-size the preview
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.componentName === name && event.data.type === 'COMPONENT_SIZE') {
        setPreviewSize(event.data.size);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [name]);

  // Reset size when component version changes
  useEffect(() => {
    setPreviewSize(null);
  }, [componentVersion]);

  // Calculate scaled preview that fits within max bounds
  const maxWidth = 240; // panel width minus padding
  const maxHeight = 120; // reasonable max
  const scale = previewSize ? Math.min(
    maxWidth / previewSize.width,
    maxHeight / previewSize.height,
    1 // don't scale up
  ) : 1;

  // Display height is scaled natural size, or fallback
  const displayHeight = previewSize ? Math.ceil(previewSize.height * scale) : 80;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-lg border border-neutral-200 overflow-hidden cursor-grab active:cursor-grabbing hover:border-neutral-300 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Preview iframe - auto-sized based on component content */}
      <div
        className="overflow-hidden bg-neutral-50 pointer-events-none flex items-center justify-center"
        style={{
          height: displayHeight,
          minHeight: 40,
        }}
      >
        <iframe
          src={previewUrl}
          className="border-none"
          style={{
            width: previewSize?.width || '100%',
            height: previewSize?.height || '100%',
            transformOrigin: 'top left',
            transform: scale !== 1 ? `scale(${scale})` : undefined,
          }}
          sandbox="allow-scripts"
          title={`Preview of ${name}`}
        />
      </div>

      {/* Component name label */}
      <div className="px-3 py-2 bg-white border-t border-neutral-100">
        <span className="text-sm font-medium text-neutral-900">{name}</span>
      </div>
    </div>
  );
}

function LibraryTab() {
  const { availableComponents, setAvailableComponents } = useCanvasStore();
  const { currentProject } = useProjectStore();

  const loadComponents = async () => {
    if (!currentProject) return;
    try {
      const result = await listProjectComponents(currentProject.id);
      if (result.status === 'success' && result.components) {
        setAvailableComponents(result.components);
      }
    } catch (err) {
      console.error('Failed to load components:', err);
    }
  };

  useEffect(() => {
    loadComponents();
  }, [currentProject?.id]);

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-400">
        <p className="text-sm">No project selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with refresh */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100">
        <span className="text-xs text-neutral-500">
          {availableComponents.length} component{availableComponents.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={loadComponents}
          className="p-1 hover:bg-neutral-100 rounded transition-colors"
          title="Refresh components"
        >
          <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      </div>

      {/* Component list with previews */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {availableComponents.map((component) => (
          <DraggableComponentCard
            key={component.name}
            name={component.name}
            projectId={currentProject.id}
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

// ============================================
// LeftPanel - Main tabbed container
// ============================================

export function LeftPanel() {
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('library');
  const { generationMode } = useCanvasStore();

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

  return (
    <div
      className="relative border-r border-neutral-200 bg-white flex flex-col h-full"
      style={{ width: panelSize }}
    >
      {/* Tab headers - hover to switch */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('create')}
          onMouseEnter={() => setActiveTab('create')}
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
          onMouseEnter={() => setActiveTab('library')}
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
        {activeTab === 'create' ? <CreateTab /> : <LibraryTab />}
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
