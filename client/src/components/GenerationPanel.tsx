import { useState, useEffect, useRef } from 'react';
import { Wand2, Loader2, ChevronUp, ChevronDown, X, Pencil, Wrench } from 'lucide-react';
import { generateComponentStream, editComponentStream } from '../lib/api';
import { useCanvasStore } from '../store/canvasStore';
import { StatusOrb } from './StatusOrb';
import { Timeline } from './Timeline';
import { config } from '../config';

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
      // Automatically start the fix
      runFix(editingComponentName, pendingFixError.message, pendingFixError.stack);
    }
  }, [generationMode, pendingFixError, editingComponentName, isGenerating]);

  // Core function to run a fix/edit operation
  const runFix = async (targetName: string, errorMessage: string, errorStack?: string) => {
    setError('');
    clearStreamingEvents();

    // Add initial event showing the error
    addStreamingEvent({
      type: 'thinking',
      message: `Fixing error: ${errorMessage}`,
      timestamp: Date.now(),
    });

    setCurrentComponentName(targetName);
    setIsGenerating(true);
    setStreamPanelExpanded(true);
    setStreamStatus('thinking');

    // Clear pending error so we don't re-trigger
    setPendingFixError(null);

    // Log what we're sending for debugging
    console.log('[Fix] Error message:', errorMessage);
    console.log('[Fix] Error stack:', errorStack);

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

      for await (const event of stream) {
        addStreamingEvent(event);

        if (event.type === 'success') {
          // Clear form after delay
          setTimeout(() => {
            setPrompt('');
            // Auto-collapse after success
            setTimeout(() => {
              setStreamPanelExpanded(false);
              setGenerationMode('create');
              setEditingComponentName(null);
            }, 2000);
          }, 1000);
        } else if (event.type === 'error') {
          setError(event.message);
        }
      }
    } catch (err) {
      setError('Network error. Make sure the backend server is running.');
      setStreamStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe what you want');
      return;
    }

    if (generationMode === 'create' && !componentName.trim()) {
      setError('Please provide a component name');
      return;
    }

    // Validate component name for create mode
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

      for await (const event of stream) {
        addStreamingEvent(event);

        if (event.type === 'success') {
          if (generationMode === 'create') {
            // Add to available components
            addAvailableComponent({
              name: targetName,
              filepath: '',
            });
          } else {
            // Reload iframe to show updated component
            if (iframeRef.current) {
              iframeRef.current.src = `${config.apiBaseUrl}/preview/${targetName}?t=${Date.now()}`;
            }
          }

          // Clear form after delay
          setTimeout(() => {
            setPrompt('');
            if (generationMode === 'create') {
              setComponentName('');
            }
            // Auto-collapse after success
            setTimeout(() => {
              setStreamPanelExpanded(false);
              if (generationMode !== 'create') {
                // Reset to create mode after edit/fix
                setGenerationMode('create');
                setEditingComponentName(null);
              }
            }, 2000);
          }, 1000);
        } else if (event.type === 'error') {
          setError(event.message);
        }
      }
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
      return generationMode === 'create' ? 'Generating' : generationMode === 'edit' ? 'Updating' : 'Fixing';
    }
    return generationMode === 'create' ? 'Generate' : generationMode === 'edit' ? 'Update' : 'Fix';
  };

  const getPlaceholder = () => {
    switch (generationMode) {
      case 'edit':
        return `Describe changes to ${editingComponentName}... (e.g., Make the button blue, add a subtitle)`;
      case 'fix':
        return `Describe the issue or let AI auto-fix ${editingComponentName}...`;
      default:
        return 'Describe your component... (e.g., A pricing card with three tiers)';
    }
  };

  return (
    <div className="border-t border-neutral-200 bg-white">
      {/* Streaming area - expandable */}
      {showStreamingArea && (
        <div className="border-b border-neutral-100 animate-fade-in">
          {/* Streaming header */}
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
              aria-label="Collapse streaming panel"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline */}
          <div className="px-4 py-2">
            <Timeline events={streamingEvents} />
          </div>

          {/* Hidden iframe for reloading edited components */}
          {generationMode !== 'create' && (
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
          <span>Show generation log</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Mode indicator for edit/fix */}
      {generationMode !== 'create' && (
        <div className="flex items-center justify-between px-4 py-2 bg-ai-thinking/10 border-b border-ai-thinking/20">
          <div className="flex items-center gap-2">
            {getModeIcon()}
            <span className="text-sm font-medium text-ai-thinking">
              {generationMode === 'edit' ? 'Editing' : 'Fixing'}: {editingComponentName}
            </span>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="Cancel edit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Prompt bar - hidden during auto-fix */}
      {generationMode !== 'fix' && (
        <div className="flex items-center gap-3 px-4 py-3">
          {generationMode === 'create' && (
            <input
              type="text"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ComponentName"
              className="w-40 px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
              disabled={isGenerating}
            />
          )}

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
            disabled={isGenerating}
          />

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || (generationMode === 'create' && !componentName.trim())}
            className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              generationMode === 'create'
                ? 'bg-neutral-900 hover:bg-neutral-800'
                : 'bg-ai-thinking hover:bg-ai-thinking/90'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{getButtonLabel()}</span>
              </>
            ) : (
              <>
                {getModeIcon()}
                <span>{getButtonLabel()}</span>
              </>
            )}
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
