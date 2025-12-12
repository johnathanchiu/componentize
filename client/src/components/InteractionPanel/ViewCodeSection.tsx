import { useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { getComponentCode } from '../../lib/api';

interface ViewCodeSectionProps {
  componentName: string;
}

export function ViewCodeSection({ componentName }: ViewCodeSectionProps) {
  const [showCode, setShowCode] = useState(false);
  const [componentCode, setComponentCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCode = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await getComponentCode(componentName);
      if (result.status === 'success') {
        setComponentCode(result.content || '');
      } else {
        setError(result.message || 'Failed to load component code');
      }
    } catch {
      setError('Network error. Make sure the backend server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!showCode) {
      await loadCode();
    }
    setShowCode(!showCode);
  };

  return (
    <div className="p-3 border-b border-gray-200">
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className="w-full px-3 py-1.5 bg-gray-600 text-white rounded-md text-xs font-medium hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-1"
      >
        {isLoading ? (
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
          {error ? (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              {error}
            </div>
          ) : (
            <pre className="p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-x-auto max-h-60 overflow-y-auto">
              {componentCode}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
