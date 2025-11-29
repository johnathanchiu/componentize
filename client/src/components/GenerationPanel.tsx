import { useState, useEffect, useRef } from 'react';
import { Wand2, Loader2, ChevronUp, ChevronDown, X, Pencil, Wrench } from 'lucide-react';
import { generateComponentStream, editComponentStream } from '../lib/api';
import { useCanvasStore } from '../store/canvasStore';
import { StatusOrb } from './StatusOrb';
import { Timeline } from './Timeline';
import { config } from '../config';

// Consistent button styles
const BUTTON_STYLES = {
  primary: 'bg-neutral-900 hover:bg-neutral-800',
  secondary: 'bg-purple-600 hover:bg-purple-700',
} as const;

export function GenerationPanel() {
  const [prompt, setPrompt] = useState('');
  const [componentName, setComponentName] = useState('');
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
        if (isCreateMode) {
          addAvailableComponent({ name: targetName, filepath: '' });
        } else if (iframeRef.current) {
          iframeRef.current.src = `${config.apiBaseUrl}/preview/${targetName}?t=${Date.now()}`;
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
    clearStreamingEvents();

    addStreamingEvent({
      type: 'thinking',
      message: `Fixing error: ${errorMessage}`,
      timestamp: Date.now(),
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
      const stream = editComponentStream(targetName, fixPrompt);
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
    clearStreamingEvents();
    const targetName = generationMode === 'create' ? componentName : editingComponentName!;

    setCurrentComponentName(targetName);
    setIsGenerating(true);
    setStreamPanelExpanded(true);
    setStreamStatus('thinking');

    try {
      const stream = generationMode === 'create'
        ? generateComponentStream(prompt, targetName)
        : editComponentStream(targetName, prompt);

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
    clearStreamingEvents();
    setStreamPanelExpanded(false);
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
      return `Describe changes to ${editingComponentName}...`;
    }
    return 'Describe your component...';
  };

  return (
    <div className="border-t border-neutral-200 bg-white">
      {/* Streaming area - expandable */}
      {showStreamingArea && (
        <div className="border-b border-neutral-100 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-50">
            <div className="flex items-center gap-2">
              <StatusOrb status={streamStatus} />
              <span className="text-sm font-medium text-neutral-700">
                {streamStatus === 'success'
                  ? `${currentComponentName} ${generationMode === 'create' ? 'created' : 'updated'}!`
                  : streamStatus === 'error'
                  ? `${getModeLabel()} failed`
                  : `${getModeLabel()} ${currentComponentName}...`}
              </span>
            </div>
            <button
              onClick={() => setStreamPanelExpanded(false)}
              className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
              aria-label="Collapse panel"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-2">
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
      )}

      {/* Collapsed streaming indicator */}
      {!isStreamPanelExpanded && streamingEvents.length > 0 && !isGenerating && (
        <button
          onClick={() => setStreamPanelExpanded(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-1.5 bg-neutral-50 border-b border-neutral-100 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <StatusOrb status={streamStatus} size="sm" />
          <span>Show log</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Mode indicator for edit/fix */}
      {isEditMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-purple-50 border-b border-purple-100">
          <div className="flex items-center gap-2 text-purple-700">
            {getModeIcon()}
            <span className="text-sm font-medium">
              {generationMode === 'edit' ? 'Editing' : 'Fixing'}: {editingComponentName}
            </span>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Prompt bar - hidden during auto-fix */}
      {generationMode !== 'fix' && (
        <div className="flex items-center gap-3 px-4 py-3 min-w-0">
          {generationMode === 'create' && (
            <input
              type="text"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ComponentName"
              className="w-40 flex-shrink-0 px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
              disabled={isGenerating}
            />
          )}

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
            disabled={isGenerating}
          />

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || (generationMode === 'create' && !componentName.trim())}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap ${
              isEditMode ? BUTTON_STYLES.secondary : BUTTON_STYLES.primary
            }`}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              getModeIcon()
            )}
            <span>{getButtonLabel()}</span>
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
