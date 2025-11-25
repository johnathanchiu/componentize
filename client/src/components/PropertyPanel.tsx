import { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';

interface PropertyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyPanel({ isOpen, onClose }: PropertyPanelProps) {
  const { selectedComponentId, canvasComponents, updatePosition, updateSize } = useCanvasStore();

  const selectedComponent = canvasComponents.find(c => c.id === selectedComponentId);

  // Local state for inputs to avoid constant updates while typing
  const [localX, setLocalX] = useState(selectedComponent?.position.x || 0);
  const [localY, setLocalY] = useState(selectedComponent?.position.y || 0);
  const [localWidth, setLocalWidth] = useState(selectedComponent?.size?.width || 200);
  const [localHeight, setLocalHeight] = useState(selectedComponent?.size?.height || 100);

  // Sync local state when selected component changes
  useEffect(() => {
    if (selectedComponent) {
      setLocalX(selectedComponent.position.x);
      setLocalY(selectedComponent.position.y);
      setLocalWidth(selectedComponent.size?.width || 200);
      setLocalHeight(selectedComponent.size?.height || 100);
    }
  }, [selectedComponent]);

  if (!isOpen || !selectedComponent) {
    return null;
  }

  const handlePositionUpdate = () => {
    updatePosition(selectedComponent.id, localX, localY);
  };

  const handleSizeUpdate = () => {
    updateSize(selectedComponent.id, localWidth, localHeight);
  };

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l-2 border-gray-300 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Properties</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="Close"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Component Info */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Component</h4>
          <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-md">
            <div className="text-sm font-medium text-purple-900">{selectedComponent.componentName}</div>
            <div className="text-xs text-purple-600 mt-0.5">ID: {selectedComponent.id}</div>
          </div>
        </div>

        {/* Position */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Position</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                X (Left)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={localX}
                  onChange={(e) => setLocalX(Number(e.target.value))}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handlePositionUpdate}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700"
                >
                  Apply
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Y (Top)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={localY}
                  onChange={(e) => setLocalY(Number(e.target.value))}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handlePositionUpdate}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Size */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Size</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Width
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={localWidth}
                  onChange={(e) => setLocalWidth(Number(e.target.value))}
                  min={100}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleSizeUpdate}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700"
                >
                  Apply
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Height
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={localHeight}
                  onChange={(e) => setLocalHeight(Number(e.target.value))}
                  min={60}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleSizeUpdate}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Interactions Info */}
        {selectedComponent.interactions && selectedComponent.interactions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Interactions</h4>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
              <div className="text-sm text-gray-700">
                {selectedComponent.interactions.length} interaction{selectedComponent.interactions.length !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Click the component to manage interactions
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with help text */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <strong>Tip:</strong> For complex styling changes, use the "Edit with AI" button in the component controls.
        </div>
      </div>
    </div>
  );
}
