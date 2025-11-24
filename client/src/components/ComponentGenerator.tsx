import { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { generateComponent } from '../lib/api';
import { useCanvasStore } from '../store/canvasStore';

export function ComponentGenerator() {
  const [prompt, setPrompt] = useState('');
  const [componentName, setComponentName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { isGenerating, setIsGenerating, addAvailableComponent } = useCanvasStore();

  const handleGenerate = async () => {
    if (!prompt.trim() || !componentName.trim()) {
      setError('Please fill in both fields');
      return;
    }

    // Validate component name
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(componentName)) {
      setError('Component name must start with an uppercase letter and contain only letters/numbers');
      return;
    }

    setError('');
    setSuccess('');
    setIsGenerating(true);

    try {
      const result = await generateComponent(prompt, componentName);

      if (result.status === 'success') {
        setSuccess(`Component '${result.component_name}' created successfully!`);

        // Add to available components
        addAvailableComponent({
          name: result.component_name || componentName,
          filepath: result.filepath || '',
        });

        // Clear form
        setPrompt('');
        setComponentName('');
      } else {
        setError(result.message || 'Failed to generate component');
      }
    } catch (err) {
      setError('Network error. Make sure the backend server is running on port 5000.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Wand2 className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-semibold text-gray-900">Generate Component</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Component Name
          </label>
          <input
            type="text"
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            placeholder="e.g., HeroSection, PricingCard"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isGenerating}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want... (e.g., A modern pricing card with a title, price, feature list, and a call-to-action button)"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            disabled={isGenerating}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Component
            </>
          )}
        </button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
