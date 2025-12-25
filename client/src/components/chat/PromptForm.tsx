import { useState, useEffect } from 'react';
import { Wand2, Loader2, X, Pencil, Wrench } from 'lucide-react';
import { useGeneration } from '@/hooks/useGeneration';
import { TodoList } from './TodoList';
import { ChatPanel } from './ChatPanel';
import { useProjectStore } from '@/store/projectStore';

export function PromptForm() {
  const [prompt, setPrompt] = useState('');
  const { currentProject } = useProjectStore();

  const {
    isGenerating,
    generationMode,
    editingComponentName,
    pendingFixError,
    agentTodos,
    error,
    generate,
    edit,
    fix,
    cancel,
    setError,
  } = useGeneration();

  // Reset form when switching modes
  useEffect(() => {
    if (generationMode === 'create') {
      setPrompt('');
    } else if (editingComponentName) {
      setPrompt('');
    }
  }, [generationMode, editingComponentName]);

  // Check for pending prompt from landing page
  useEffect(() => {
    const pendingPrompt = sessionStorage.getItem('pendingPrompt');
    if (pendingPrompt && currentProject && !isGenerating) {
      sessionStorage.removeItem('pendingPrompt');
      setTimeout(() => {
        setPrompt(pendingPrompt);
        generate(pendingPrompt);
      }, 100);
    }
  }, [currentProject?.id, isGenerating, generate]);

  // Auto-trigger fix when there's a pending error
  useEffect(() => {
    if (generationMode === 'fix' && pendingFixError && editingComponentName && !isGenerating) {
      fix(editingComponentName, pendingFixError.message, pendingFixError.stack);
    }
  }, [generationMode, pendingFixError, editingComponentName, isGenerating, fix]);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError('Please describe what you want');
      return;
    }

    if (generationMode === 'create') {
      generate(prompt);
    } else if (editingComponentName) {
      edit(editingComponentName, prompt);
    }

    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isEditMode = generationMode === 'edit' || generationMode === 'fix';

  const getModeIcon = () => {
    switch (generationMode) {
      case 'edit':
        return <Pencil className="w-4 h-4" />;
      case 'fix':
        return <Wrench className="w-4 h-4" />;
      default:
        return <Wand2 className="w-4 h-4" />;
    }
  };

  const getPlaceholder = () => {
    if (generationMode === 'edit') {
      return 'Describe changes...';
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
      {/* Chat area */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          <ChatPanel />
        </div>
      </div>

      {/* Form area */}
      <div className="flex-shrink-0 p-3 border-t border-neutral-100">
        {/* Todo list */}
        <TodoList todos={agentTodos} />

        {/* Edit mode indicator */}
        {isEditMode && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-purple-50 rounded-lg">
            {getModeIcon()}
            <span className="text-sm text-purple-700 font-medium flex-1 truncate">
              {generationMode === 'edit' ? 'Editing' : 'Fixing'}: {editingComponentName}
            </span>
            <button
              onClick={cancel}
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
            rows={4}
            disabled={isGenerating}
          />
        )}

        {/* Generate button */}
        {generationMode !== 'fix' && (
          <button
            onClick={handleSubmit}
            disabled={isGenerating || !prompt.trim()}
            className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
              isEditMode
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
