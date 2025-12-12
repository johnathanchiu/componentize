import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { generateInteractionStream } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';
import type { Interaction } from '../../types/index';

interface AddInteractionFormProps {
  componentId: string;
  componentName: string;
  onClose: () => void;
}

export function AddInteractionForm({ componentId, componentName, onClose }: AddInteractionFormProps) {
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<'onClick' | 'onChange' | 'onSubmit'>('onClick');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const { addInteraction } = useCanvasStore();

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please describe what should happen');
      return;
    }

    setError('');
    setProgress('');
    setIsGenerating(true);

    try {
      for await (const event of generateInteractionStream(
        componentId,
        componentName,
        description,
        eventType
      )) {
        if (event.type === 'progress' || event.type === 'tool_start') {
          setProgress(event.message);
        } else if (event.type === 'success') {
          const interaction = event.data?.result as Interaction | undefined;
          if (interaction) {
            addInteraction(componentId, interaction);
            onClose();
          }
        } else if (event.type === 'error') {
          setError(event.message);
          setProgress('');
        }
      }
    } catch {
      setError('Network error. Make sure the backend server is running on port 5001.');
      setProgress('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Event Type
        </label>
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as 'onClick' | 'onChange' | 'onSubmit')}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isGenerating}
        >
          <option value="onClick">onClick</option>
          <option value="onChange">onChange</option>
          <option value="onSubmit">onSubmit</option>
        </select>
      </div>

      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          What should happen?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Show an alert saying 'Hello!'"
          rows={3}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          disabled={isGenerating}
        />
      </div>

      {progress && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          {progress}
        </div>
      )}

      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              Generate
            </>
          )}
        </button>
        <button
          onClick={handleCancel}
          disabled={isGenerating}
          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
