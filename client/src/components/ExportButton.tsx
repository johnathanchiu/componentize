import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { exportPageAsZip } from '@/lib/api';
import { useCanvasComponents } from '@/store/canvasStore';
import { useCurrentProject } from '@/store/projectStore';

export function ExportButton() {
  // Use typed selector hooks for optimal re-rendering
  const canvasComponents = useCanvasComponents();
  const currentProject = useCurrentProject();
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (!currentProject) {
      setError('No project selected');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (canvasComponents.length === 0) {
      setError('Add some components to the canvas first!');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setIsExporting(true);
    setError('');
    setExported(false);

    try {
      // Export page as ZIP with all components and dependencies
      const pageName = currentProject.name.replace(/\s+/g, '');
      const blob = await exportPageAsZip(pageName, {
        components: canvasComponents,
      }, currentProject.id);

      // Download the ZIP file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pageName}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (err) {
      setError('Failed to export. Make sure the backend server is running.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={isExporting || canvasComponents.length === 0}
        className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        {exported ? (
          <>
            <Check className="w-4 h-4" />
            Exported!
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export Page'}
          </>
        )}
      </button>

      {error && (
        <div className="absolute top-full mt-2 right-0 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800 whitespace-nowrap shadow-lg z-10">
          {error}
        </div>
      )}
    </div>
  );
}
