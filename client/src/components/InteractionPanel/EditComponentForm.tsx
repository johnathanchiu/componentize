import { useState } from 'react';
import { Edit3, Loader2 } from 'lucide-react';
import { editComponentStream } from '../../lib/api';

interface EditComponentFormProps {
  componentName: string;
  onSuccess?: () => void;
}

export function EditComponentForm({ componentName, onSuccess }: EditComponentFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleEdit = async () => {
    if (!description.trim()) {
      setError('Please describe what changes to make');
      return;
    }

    setError('');
    setSuccess('');
    setProgress('');
    setIsEditing(true);

    try {
      for await (const event of editComponentStream(componentName, description)) {
        if (event.type === 'progress' || event.type === 'tool_start') {
          setProgress(event.message);
        } else if (event.type === 'success') {
          setSuccess(`Component '${componentName}' updated successfully!`);
          setProgress('');
          setDescription('');
          setShowForm(false);
          onSuccess?.();
          setTimeout(() => setSuccess(''), 3000);
        } else if (event.type === 'error') {
          setError(event.message);
          setProgress('');
        }
      }
    } catch {
      setError('Network error. Make sure the backend server is running on port 5001.');
      setProgress('');
    } finally {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setDescription('');
    setError('');
  };

  return (
    <div className="p-3 border-b border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <Edit3 className="w-3 h-3 text-blue-600" />
          <h4 className="text-xs font-semibold text-gray-700">Edit Component</h4>
        </div>
      </div>

      {success && (
        <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
          {success}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 flex items-center justify-center gap-1"
        >
          <Edit3 className="w-3 h-3" />
          Edit with AI
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Center the text and make the button blue"
            rows={3}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={isEditing}
          />

          {progress && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
              {progress}
            </div>
          )}

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              {error}
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
              onClick={handleCancel}
              disabled={isEditing}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
