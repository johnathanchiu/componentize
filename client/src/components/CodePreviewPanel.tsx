import { useEffect, useState } from 'react';
import { Code2, RefreshCw, X } from 'lucide-react';
import { getProjectComponentCode } from '../lib/api';
import { useGenerationStore } from '../store/generationStore';
import { useProjectStore } from '../store/projectStore';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { ResizeHandle } from './ResizeHandle';

export function CodePreviewPanel() {
  const { generationMode, editingComponentName, streamStatus } = useGenerationStore();
  const { currentProject } = useProjectStore();
  const [code, setCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isHidden, setIsHidden] = useState(false);

  const { panelSize, isResizing, handleMouseDown } = useResizablePanel({
    storageKey: 'code-panel-width',
    direction: 'horizontal',
    defaultSize: 320,
    minSize: 250,
    maxSize: 600,
    resizeFrom: 'left',
  });

  // Only show when editing or fixing (and not manually hidden)
  const isVisible = (generationMode === 'edit' || generationMode === 'fix') && editingComponentName && !isHidden;

  // Reset hidden state when editing a new component
  useEffect(() => {
    if (editingComponentName) {
      setIsHidden(false);
    }
  }, [editingComponentName]);

  // Load code when component changes or after successful update
  useEffect(() => {
    if (!editingComponentName) {
      setCode('');
      return;
    }

    loadCode();
  }, [editingComponentName]);

  // Reload code after successful edit/fix
  useEffect(() => {
    if (streamStatus === 'success' && editingComponentName) {
      // Small delay to ensure file is written
      setTimeout(() => loadCode(), 500);
    }
  }, [streamStatus, editingComponentName]);

  const loadCode = async () => {
    if (!editingComponentName || !currentProject) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await getProjectComponentCode(currentProject.id, editingComponentName);
      if (result.status === 'success') {
        setCode(result.content || '');
      } else {
        setError(result.message || 'Failed to load code');
      }
    } catch (err) {
      setError('Failed to load component code');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="relative border-l border-neutral-200 bg-white flex flex-col"
      style={{ width: panelSize }}
    >
      {/* Resize handle */}
      <ResizeHandle
        isResizing={isResizing}
        onMouseDown={handleMouseDown}
        direction="horizontal"
        position="left"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-neutral-500" />
          <span className="text-sm font-semibold text-neutral-900">
            {editingComponentName}.tsx
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadCode}
            disabled={isLoading}
            className="p-1 hover:bg-neutral-100 rounded transition-colors"
            title="Refresh code"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsHidden(true)}
            className="p-1 hover:bg-neutral-100 rounded transition-colors"
            title="Hide panel"
          >
            <X className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-neutral-400 text-sm">
            Loading...
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <pre className="p-4 text-xs font-mono text-neutral-700 leading-relaxed whitespace-pre-wrap">
            {code}
          </pre>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-neutral-100 bg-neutral-50">
        <p className="text-xs text-neutral-400">
          {generationMode === 'fix' ? 'Fixing errors...' : 'Describe changes in the Create tab'}
        </p>
      </div>
    </div>
  );
}
