import { useState, useEffect, useRef, type ComponentType } from 'react';
import { Wand2, Loader2, X, Pencil, Wrench, RefreshCw, Trash2 } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { generateStream, editProjectComponentStream, listProjectComponents, deleteProjectComponent } from '../lib/api';
import { useCanvasStore } from '../store/canvasStore';
import { useProjectStore } from '../store/projectStore';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { ResizeHandle } from './ResizeHandle';
import { StatusOrb } from './StatusOrb';
import { Timeline } from './Timeline';
import { loadComponent } from '../lib/componentRenderer';
import type { Size } from '../types/index';

// ============================================
// CreateTab - Component generation/editing
// ============================================

function CreateTab() {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { currentProject } = useProjectStore();
  const {
    isGenerating,
    setIsGenerating,
    addAvailableComponent,
    addToCanvas,
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
      setPrompt('');
    } else if (editingComponentName) {
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
    isCreateMode: boolean
  ) => {
    for await (const event of stream) {
      addStreamingEvent(event);

      // Handle canvas_update events to add new components
      if (event.type === 'canvas_update' && event.data?.canvasComponent) {
        const comp = event.data.canvasComponent;
        // Add to library
        addAvailableComponent({ name: comp.componentName, filepath: '' });
        // Add to canvas with position from agent
        addToCanvas(comp);
        incrementComponentVersion(comp.componentName);
        setCurrentComponentName(comp.componentName);
      }

      if (event.type === 'success') {
        // Clear form after delay
        setTimeout(() => {
          setPrompt('');
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
      await handleStreamResponse(stream, false);
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

    setError('');

    // Add session divider
    const modeLabel = generationMode === 'create' ? 'Generating' : 'Editing';
    const targetLabel = generationMode === 'create' ? 'components' : editingComponentName!;
    addStreamingEvent({
      type: 'session_start',
      message: `${modeLabel} ${targetLabel}`,
      timestamp: Date.now(),
      data: { mode: generationMode, componentName: targetLabel },
    });

    setCurrentComponentName(targetLabel);
    setIsGenerating(true);
    setStreamPanelExpanded(true);
    setStreamStatus('thinking');

    try {
      if (!currentProject) {
        setError('No project selected');
        setStreamStatus('error');
        return;
      }

      // Use unified generateStream for create, editProjectComponentStream for edits
      const stream = generationMode === 'create'
        ? generateStream(currentProject.id, prompt)
        : editProjectComponentStream(currentProject.id, editingComponentName!, prompt);

      await handleStreamResponse(stream, generationMode === 'create');
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

  const getPlaceholder = () => {
    if (generationMode === 'edit') {
      return `Describe changes...`;
    }
    return 'Describe what you want... (e.g., "a blue button" or "a SaaS landing page")';
  };

  const getButtonLabel = () => {
    if (isGenerating) {
      return generationMode === 'create' ? 'Generating...' : 'Updating...';
    }
    return generationMode === 'create' ? 'Generate' : 'Update';
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

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
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

      {/* Form area - at bottom, fixed height */}
      <div className="flex-shrink-0 p-3 border-t border-neutral-100">
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

        {/* Prompt textarea - only show when not in fix mode */}
        {generationMode !== 'fix' && (
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
            rows={showStreamingArea ? 2 : 4}
            disabled={isGenerating}
          />
        )}

        {/* Generate button */}
        {generationMode !== 'fix' && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${isEditMode
              ? 'bg-purple-600 hover:bg-purple-700'
              : 'bg-neutral-900 hover:bg-neutral-800'
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

function DraggableComponentCard({ name, projectId, onDelete }: { name: string; projectId: string; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${name}`,
    data: { componentName: name, source: 'library' },
  });
  const { componentVersions } = useCanvasStore();
  const componentVersion = componentVersions[name] || 0;
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [loading, setLoading] = useState(true);
  const componentRef = useRef<HTMLDivElement>(null);

  // Load component when projectId, name, or version changes
  useEffect(() => {
    setLoading(true);
    setNaturalSize(null); // Reset size when reloading
    loadComponent(projectId, name)
      .then((comp) => {
        setComponent(() => comp);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load component for preview:', err);
        setLoading(false);
      });
  }, [projectId, name, componentVersion]);

  // Measure component's natural size using ResizeObserver
  useEffect(() => {
    if (!Component || !componentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setNaturalSize({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });

    observer.observe(componentRef.current);
    return () => observer.disconnect();
  }, [Component]);

  // Calculate scale to fit within max bounds
  const maxWidth = 220; // panel width minus padding
  const maxHeight = 100; // reasonable max
  const scale = naturalSize ? Math.min(
    maxWidth / naturalSize.width,
    maxHeight / naturalSize.height,
    1 // don't scale up
  ) : 1;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group/card relative rounded-lg border border-neutral-200 overflow-hidden cursor-grab active:cursor-grabbing hover:border-neutral-300 transition-colors ${isDragging ? 'opacity-50' : ''
        }`}
    >
      {/* Delete button - floats in top-right corner */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDelete();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1 right-1 z-10 p-1.5 rounded bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover/card:opacity-100 transition-opacity shadow-sm"
        title="Delete component"
      >
        <Trash2 className="w-3 h-3" />
      </button>

      {/* Preview container - centers the component */}
      <div
        className="bg-neutral-50 pointer-events-none flex items-center justify-center overflow-hidden"
        style={{ minHeight: 50, padding: 8 }}
      >
        {loading && (
          <div className="text-xs text-neutral-400">Loading...</div>
        )}
        {!loading && Component && (
          <div
            ref={componentRef}
            className="inline-block"
            style={{
              transformOrigin: 'center',
              transform: scale !== 1 ? `scale(${scale})` : undefined,
            }}
          >
            <Component />
          </div>
        )}
      </div>

      {/* Component name label */}
      <div className="px-3 py-2 bg-white border-t border-neutral-100">
        <span className="text-sm font-medium text-neutral-900">{name}</span>
      </div>
    </div>
  );
}

function LibraryTab() {
  const { availableComponents, setAvailableComponents, removeAvailableComponent } = useCanvasStore();
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

  const handleDeleteComponent = async (componentName: string) => {
    if (!currentProject) return;
    if (!window.confirm(`Delete "${componentName}"? This cannot be undone.`)) return;

    try {
      const result = await deleteProjectComponent(currentProject.id, componentName);
      if (result.status === 'success') {
        removeAvailableComponent(componentName);
      } else {
        console.error('Failed to delete component:', result.message);
      }
    } catch (err) {
      console.error('Failed to delete component:', err);
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
            onDelete={() => handleDeleteComponent(component.name)}
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
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'create'
            ? 'text-neutral-900 border-b-2 border-neutral-900'
            : 'text-neutral-500 hover:text-neutral-700'
            }`}
        >
          Create
        </button>
        <button
          onClick={() => setActiveTab('library')}
          onMouseEnter={() => setActiveTab('library')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'library'
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
