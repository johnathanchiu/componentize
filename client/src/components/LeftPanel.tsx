import { useState, useEffect, useRef, type ComponentType } from 'react';
import { Wand2, Loader2, X, Pencil, Wrench, RefreshCw, Trash2 } from 'lucide-react';
import { generateStream, editProjectComponentStream, getProject, deleteProjectComponent } from '../lib/api';
import { useCanvasStore } from '../store/canvasStore';
import { useGenerationStore } from '../store/generationStore';
import { useProjectStore } from '../store/projectStore';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { ResizeHandle } from './ResizeHandle';
import { ChatPanel } from './ChatPanel';
import { loadComponent } from '../lib/componentRenderer';
import type { Size } from '../types/index';

// ============================================
// CreateTab - Component generation/editing
// ============================================

function CreateTab() {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { currentProject, addAvailableComponent } = useProjectStore();
  const { addToCanvas } = useCanvasStore();
  const {
    isGenerating,
    setIsGenerating,
    streamingEvents,
    isStreamPanelExpanded,
    generationMode,
    editingComponentName,
    pendingFixError,
    agentTodos,
    addStreamingEvent,
    setStreamStatus,
    setStreamPanelExpanded,
    setCurrentComponentName,
    setGenerationMode,
    setEditingComponentName,
    setPendingFixError,
    incrementComponentVersion,
    setAgentTodos,
    // Block accumulation actions for delta-based streaming
    startNewBlock,
    appendThinkingDelta,
    appendTextDelta,
    addToolCall,
    setToolResult,
    completeBlock,
    // Conversation message actions
    addUserMessage,
    startAssistantMessage,
    completeAssistantMessage,
    updateCurrentAssistantThinking,
  } = useGenerationStore();

  // Reset form when switching modes
  useEffect(() => {
    if (generationMode === 'create') {
      setPrompt('');
    } else if (editingComponentName) {
      setPrompt('');
    }
  }, [generationMode, editingComponentName]);

  // Check for pending prompt from landing page (auto-trigger generation)
  useEffect(() => {
    const pendingPrompt = sessionStorage.getItem('pendingPrompt');
    if (pendingPrompt && currentProject && !isGenerating) {
      sessionStorage.removeItem('pendingPrompt');
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        setPrompt(pendingPrompt);
        // Trigger generation
        triggerGenerationWithPrompt(pendingPrompt);
      }, 100);
    }
  }, [currentProject?.id]);

  // Function to trigger generation with a specific prompt (used by auto-trigger)
  const triggerGenerationWithPrompt = async (promptText: string) => {
    if (!promptText.trim()) return;

    setError('');

    // Note: session_start and user_message events come from the server now
    // to avoid duplication
    setCurrentComponentName('components');
    setIsGenerating(true);
    setStreamPanelExpanded(true);
    setStreamStatus('thinking');

    try {
      if (!currentProject) {
        setError('No project selected');
        setStreamStatus('error');
        return;
      }

      const stream = generateStream(currentProject.id, promptText);
      await handleStreamResponse(stream, true, promptText);
    } catch (err) {
      setError('Network error. Make sure the backend server is running.');
      setStreamStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-trigger fix when there's a pending error
  useEffect(() => {
    if (generationMode === 'fix' && pendingFixError && editingComponentName && !isGenerating) {
      runFix(editingComponentName, pendingFixError.message, pendingFixError.stack);
    }
  }, [generationMode, pendingFixError, editingComponentName, isGenerating]);

  // Shared function to handle streaming response
  const handleStreamResponse = async (
    stream: AsyncGenerator<any>,
    isCreateMode: boolean,
    userPrompt: string
  ) => {
    // Add user message to conversation
    addUserMessage(userPrompt);
    // Start assistant message for streaming
    startAssistantMessage();

    for await (const event of stream) {
      // Always add to streaming events for timeline rendering (backward compat)
      addStreamingEvent(event);

      // Handle new delta-based events for block accumulation
      switch (event.type) {
        case 'turn_start':
          startNewBlock();
          break;

        case 'thinking_delta':
          // Extended thinking: Claude's internal reasoning
          if (event.data?.content) {
            appendThinkingDelta(event.data.content);
            // Also persist to assistant message so it survives tool calls
            const currentThinking = useGenerationStore.getState().currentBlock?.thinking || '';
            updateCurrentAssistantThinking(currentThinking);
          }
          break;

        case 'text_delta':
          // Extended thinking: Claude's response to user (separate from thinking)
          if (event.data?.content) {
            appendTextDelta(event.data.content);
          }
          break;

        case 'tool_call':
          if (event.data?.toolUseId && event.data?.toolName) {
            addToolCall(event.data.toolUseId, event.data.toolName, event.data.toolInput || {});
          }
          break;

        case 'tool_result':
          if (event.data?.toolUseId) {
            setToolResult(
              event.data.toolUseId,
              event.data.status || 'success',
              event.data.result
            );
          }
          break;

        case 'todo_update':
          if (event.data?.todos) {
            setAgentTodos(event.data.todos);
          }
          break;

        case 'canvas_update':
          if (event.data?.canvasComponent) {
            const comp = event.data.canvasComponent;
            addAvailableComponent({ name: comp.componentName, filepath: '' });
            addToCanvas(comp);
            incrementComponentVersion(comp.componentName);
            setCurrentComponentName(comp.componentName);
          }
          break;

        case 'complete': {
          // Get the current block state before completing
          const block = useGenerationStore.getState().currentBlock;
          // With extended thinking: block.text contains the response, block.thinking contains reasoning
          // The content is always in block.text (or fallback to event.data.content)
          const content = block?.text || (event.data?.content as string) || '';
          completeBlock();
          // Always pass the content, thinking is preserved in the assistant message
          completeAssistantMessage(content);
          // Clear todos on successful completion
          setAgentTodos([]);
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
          break;
        }

        case 'error':
          completeBlock();
          completeAssistantMessage();
          setError(event.message);
          break;

        // Legacy event handling (for backward compatibility)
        case 'success':
          completeAssistantMessage();
          setAgentTodos([]);
          setTimeout(() => {
            setPrompt('');
            setTimeout(() => {
              setStreamPanelExpanded(false);
              if (!isCreateMode) {
                setGenerationMode('create');
                setEditingComponentName(null);
              }
            }, 2000);
          }, 1000);
          break;
      }
    }
  };

  // Core function to run a fix operation
  const runFix = async (targetName: string, errorMessage: string, errorStack?: string) => {
    setError('');

    // Note: session_start and user_message events come from the server now
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
      await handleStreamResponse(stream, false, fixPrompt);
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

    // Note: session_start and user_message events come from the server now
    // to avoid duplication
    const targetLabel = generationMode === 'create' ? 'components' : editingComponentName!;
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

      await handleStreamResponse(stream, generationMode === 'create', prompt);
    } catch (err) {
      setError('Network error. Make sure the backend server is running.');
      setStreamStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
      e.preventDefault();
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
      {/* Chat area - fills available space */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          <ChatPanel />
        </div>

        {isEditMode && (
          <iframe
            ref={iframeRef}
            className="hidden"
            title="Component reload trigger"
          />
        )}
      </div>

      {/* Form area - at bottom, fixed height */}
      <div className="flex-shrink-0 p-3 border-t border-neutral-100">
        {/* Agent-managed TODO list */}
        {agentTodos.length > 0 && (
          <div className="mb-3 px-2 py-2 bg-neutral-50 rounded-lg border border-neutral-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-600">
                Tasks: {agentTodos.filter(t => t.status === 'completed').length}/{agentTodos.length}
              </span>
            </div>
            <div className="space-y-1">
              {agentTodos.map(todo => (
                <div
                  key={todo.id}
                  className={`flex items-center gap-2 text-xs ${
                    todo.status === 'completed' ? 'text-green-600' :
                    todo.status === 'in_progress' ? 'text-blue-600' : 'text-neutral-500'
                  }`}
                >
                  <span className="w-4 text-center">
                    {todo.status === 'completed' ? '✓' :
                     todo.status === 'in_progress' ? '→' : '○'}
                  </span>
                  <span className={todo.status === 'completed' ? 'line-through' : ''}>
                    {todo.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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

// Error boundary for component previews
import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ComponentErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface DraggableComponentCardProps {
  name: string;
  projectId: string;
  onDelete: () => void;
  onError?: (componentName: string, error: string) => void;
  onSuccess?: (componentName: string) => void;
}

function DraggableComponentCard({ name, projectId, onDelete, onError, onSuccess }: DraggableComponentCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { componentVersions, startFixing } = useGenerationStore();
  const componentVersion = componentVersions[name] || 0;
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  // Load component when projectId, name, or version changes
  useEffect(() => {
    setLoading(true);
    setNaturalSize(null); // Reset size when reloading
    setRenderError(null); // Clear any previous render errors
    loadComponent(projectId, name)
      .then((comp) => {
        setComponent(() => comp);
        setLoading(false);
        // Don't call onSuccess yet - wait for actual render
      })
      .catch((err) => {
        console.error('Failed to load component for preview:', err);
        setLoading(false);
        onError?.(name, err.message || 'Failed to load component');
      });
  }, [projectId, name, componentVersion]);

  // Report render errors to parent - only once per error
  const reportedErrorRef = useRef<string | null>(null);
  const reportedSuccessRef = useRef(false);

  useEffect(() => {
    if (renderError && renderError !== reportedErrorRef.current) {
      reportedErrorRef.current = renderError;
      reportedSuccessRef.current = false;
      onError?.(name, renderError);
    } else if (!loading && Component && !renderError && !reportedSuccessRef.current) {
      // Component loaded and rendered successfully - only report once
      reportedSuccessRef.current = true;
      reportedErrorRef.current = null;
      onSuccess?.(name);
    }
  }, [renderError, loading, Component, name, onError, onSuccess]);

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

  // Native drag handlers for React Flow compatibility
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/componentName', name);
    e.dataTransfer.effectAllowed = 'move';

    // Create custom drag image that follows cursor
    const dragImage = document.createElement('div');
    dragImage.textContent = name;
    dragImage.style.cssText = 'padding: 8px 16px; background: white; border: 2px solid #171717; border-radius: 8px; font-size: 14px; font-weight: 500; position: absolute; top: -1000px; left: -1000px;';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);
    setTimeout(() => document.body.removeChild(dragImage), 0);

    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
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
        {!loading && renderError && (
          <div className="text-xs text-red-500 text-center px-2 pointer-events-auto">
            <div className="font-medium">Render error</div>
            <div className="text-red-400 truncate" title={renderError}>{renderError}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                startFixing(name, { message: renderError });
              }}
              className="mt-1.5 px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium transition-colors"
            >
              <Wrench className="w-3 h-3 inline mr-1" />
              Fix
            </button>
          </div>
        )}
        {!loading && !renderError && Component && (
          <ComponentErrorBoundary
            fallback={
              <div className="text-xs text-red-500 text-center px-2 pointer-events-auto">
                <div className="font-medium">Component crashed</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startFixing(name, { message: 'Component crashed during render' });
                  }}
                  className="mt-1.5 px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium transition-colors"
                >
                  <Wrench className="w-3 h-3 inline mr-1" />
                  Fix
                </button>
              </div>
            }
            onError={(err) => setRenderError(err.message)}
          >
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
          </ComponentErrorBoundary>
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
  const { currentProject, availableComponents, setAvailableComponents, removeAvailableComponent } = useProjectStore();
  const { startFixing, isGenerating } = useGenerationStore();
  const [brokenComponents, setBrokenComponents] = useState<Map<string, string>>(new Map());

  // Track when a component reports an error
  const handleComponentError = (componentName: string, error: string) => {
    setBrokenComponents(prev => new Map(prev).set(componentName, error));
  };

  // Clear error when component loads successfully
  const handleComponentSuccess = (componentName: string) => {
    setBrokenComponents(prev => {
      const next = new Map(prev);
      next.delete(componentName);
      return next;
    });
  };

  // Fix all broken components sequentially
  const handleFixAll = async () => {
    const brokenList = Array.from(brokenComponents.entries());
    if (brokenList.length === 0) return;

    // Start fixing the first one - the rest will be queued via the fix flow
    const [firstName, firstError] = brokenList[0];
    startFixing(firstName, { message: firstError });
  };

  const loadComponents = async () => {
    if (!currentProject) return;
    try {
      const result = await getProject(currentProject.id);
      setAvailableComponents(result.components);
    } catch (err) {
      console.error('Failed to load components:', err);
    }
  };

  const handleDeleteComponent = async (componentName: string) => {
    if (!currentProject) return;
    if (!window.confirm(`Delete "${componentName}"? This cannot be undone.`)) return;

    try {
      await deleteProjectComponent(currentProject.id, componentName);
      removeAvailableComponent(componentName);
      // Also remove from broken components if it was there
      setBrokenComponents(prev => {
        const next = new Map(prev);
        next.delete(componentName);
        return next;
      });
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

  const brokenCount = brokenComponents.size;

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
              onClick={handleFixAll}
              disabled={isGenerating}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Fix all ${brokenCount} broken component${brokenCount !== 1 ? 's' : ''}`}
            >
              <Wrench className="w-3 h-3" />
              Fix All
            </button>
          )}
          <button
            onClick={loadComponents}
            className="p-1 hover:bg-neutral-100 rounded transition-colors"
            title="Refresh components"
          >
            <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Component list with previews */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {availableComponents.map((component) => (
          <DraggableComponentCard
            key={component.name}
            name={component.name}
            projectId={currentProject.id}
            onDelete={() => handleDeleteComponent(component.name)}
            onError={handleComponentError}
            onSuccess={handleComponentSuccess}
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
  const { generationMode } = useGenerationStore();
  const { currentProject } = useProjectStore();

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

  // Auto-switch to Create tab when there's a pending prompt from landing page
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
      {/* Tab headers - hover to switch */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'create'
            ? 'text-neutral-900 border-b-2 border-neutral-900'
            : 'text-neutral-500 hover:text-neutral-700'
            }`}
        >
          Create
        </button>
        <button
          onClick={() => setActiveTab('library')}
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
