import { useState } from 'react';
import { Zap, Plus, Trash2, Loader2, Code2, Edit3, Eye } from 'lucide-react';
import { generateInteractionStream, editComponentStream, getComponentCode } from '../lib/api';
import { useCanvasStore } from '../store/canvasStore';
import type { Interaction } from '../types/index';

interface InteractionPanelProps {
  componentId: string;
  componentName: string;
  interactions?: Interaction[];
}

export function InteractionPanel({ componentId, componentName, interactions = [] }: InteractionPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<'onClick' | 'onChange' | 'onSubmit'>('onClick');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  // Edit component state
  const [showEditForm, setShowEditForm] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editProgress, setEditProgress] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // View code state
  const [showCode, setShowCode] = useState(false);
  const [componentCode, setComponentCode] = useState('');
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  const { addInteraction, removeInteraction } = useCanvasStore();

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
        if (event.type === 'progress' || event.type === 'tool_call') {
          setProgress(event.message);
        } else if (event.type === 'success') {
          if (event.data?.interaction) {
            addInteraction(componentId, event.data.interaction);
            setDescription('');
            setShowAddForm(false);
            setProgress('');
          }
        } else if (event.type === 'error') {
          setError(event.message);
          setProgress('');
        }
      }
    } catch (err) {
      setError('Network error. Make sure the backend server is running on port 5001.');
      setProgress('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = (interactionId: string) => {
    removeInteraction(componentId, interactionId);
  };

  const handleEdit = async () => {
    if (!editDescription.trim()) {
      setEditError('Please describe what changes to make');
      return;
    }

    setEditError('');
    setEditSuccess('');
    setEditProgress('');
    setIsEditing(true);

    try {
      for await (const event of editComponentStream(componentName, editDescription)) {
        if (event.type === 'progress' || event.type === 'tool_call') {
          setEditProgress(event.message);
        } else if (event.type === 'success') {
          setEditSuccess(`Component '${componentName}' updated successfully!`);
          setEditProgress('');
          setEditDescription('');
          setShowEditForm(false);
          // Refresh code if it's being shown
          if (showCode) {
            loadComponentCode();
          }
          // Clear success message after 3 seconds
          setTimeout(() => setEditSuccess(''), 3000);
        } else if (event.type === 'error') {
          setEditError(event.message);
          setEditProgress('');
        }
      }
    } catch (err) {
      setEditError('Network error. Make sure the backend server is running on port 5001.');
      setEditProgress('');
    } finally {
      setIsEditing(false);
    }
  };

  const loadComponentCode = async () => {
    setIsLoadingCode(true);
    setCodeError('');

    try {
      const result = await getComponentCode(componentName);

      if (result.status === 'success') {
        setComponentCode(result.content || '');
      } else {
        setCodeError(result.message || 'Failed to load component code');
      }
    } catch (err) {
      setCodeError('Network error. Make sure the backend server is running.');
    } finally {
      setIsLoadingCode(false);
    }
  };

  const handleViewCode = async () => {
    if (!showCode) {
      await loadComponentCode();
    }
    setShowCode(!showCode);
  };

  return (
    <div className="absolute -right-2 top-full mt-2 w-80 bg-white border-2 border-purple-500 rounded-lg shadow-xl z-50 max-h-[500px] overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 bg-purple-50 border-b border-purple-200 flex items-center gap-2 sticky top-0 z-10">
        <Zap className="w-4 h-4 text-purple-600" />
        <h3 className="text-sm font-semibold text-gray-900">Component Controls</h3>
        <span className="text-xs text-gray-500">({componentName})</span>
      </div>

      {/* Edit Component Section */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <Edit3 className="w-3 h-3 text-blue-600" />
            <h4 className="text-xs font-semibold text-gray-700">Edit Component</h4>
          </div>
        </div>

        {editSuccess && (
          <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
            {editSuccess}
          </div>
        )}

        {!showEditForm ? (
          <button
            onClick={() => setShowEditForm(true)}
            className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 flex items-center justify-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            Edit with AI
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="e.g., Center the text and make the button blue"
              rows={3}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={isEditing}
            />

            {editProgress && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                {editProgress}
              </div>
            )}

            {editError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                {editError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                disabled={isEditing}
                className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                {isEditing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3 h-3" />
                    Update
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditDescription('');
                  setEditError('');
                }}
                disabled={isEditing}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Code Section */}
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={handleViewCode}
          disabled={isLoadingCode}
          className="w-full px-3 py-1.5 bg-gray-600 text-white rounded-md text-xs font-medium hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {isLoadingCode ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              {showCode ? 'Hide Code' : 'View Code'}
            </>
          )}
        </button>

        {showCode && (
          <div className="mt-2">
            {codeError ? (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                {codeError}
              </div>
            ) : (
              <pre className="p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-x-auto max-h-60 overflow-y-auto">
                {componentCode}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Interactions Section Header */}
      <div className="px-3 py-2 bg-gray-50">
        <h4 className="text-xs font-semibold text-gray-700">Interactions</h4>
      </div>

      {/* Existing Interactions */}
      <div className="p-3 max-h-60 overflow-y-auto">
        {interactions.length === 0 && !showAddForm && (
          <div className="text-center py-4 text-sm text-gray-400">
            No interactions yet
          </div>
        )}

        {interactions.map((interaction) => (
          <div
            key={interaction.id}
            className="mb-2 p-3 bg-gray-50 border border-gray-200 rounded-md group"
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                    {interaction.type}
                  </span>
                  <button
                    onClick={() => handleDelete(interaction.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">{interaction.description}</p>
              </div>
            </div>

            {/* Code Preview Toggle */}
            <button
              onClick={() => setExpandedCode(expandedCode === interaction.id ? null : interaction.id)}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 mt-2"
            >
              <Code2 className="w-3 h-3" />
              {expandedCode === interaction.id ? 'Hide code' : 'Show code'}
            </button>

            {expandedCode === interaction.id && (
              <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-x-auto">
                {interaction.code}
              </pre>
            )}
          </div>
        ))}

        {/* Add Form */}
        {showAddForm && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
            <div className="mb-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Event Type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as any)}
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
                onClick={() => {
                  setShowAddForm(false);
                  setDescription('');
                  setError('');
                }}
                disabled={isGenerating}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Button */}
      {!showAddForm && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full px-3 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Interaction
          </button>
        </div>
      )}
    </div>
  );
}
