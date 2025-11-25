import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { Settings } from 'lucide-react';
import { ComponentGenerator } from './components/ComponentGenerator';
import { ComponentLibrary } from './components/ComponentLibrary';
import { DragDropCanvas } from './components/DragDropCanvas';
import { ExportButton } from './components/ExportButton';
import { PropertyPanel } from './components/PropertyPanel';
import { useCanvasStore } from './store/canvasStore';

function App() {
  const { addToCanvas, updatePosition, canvasComponents, selectedComponentId } = useCanvasStore();
  const [activeComponentName, setActiveComponentName] = useState<string | null>(null);
  const [isPropertyPanelOpen, setIsPropertyPanelOpen] = useState(false);

  const handleDragStart = (event: DragStartEvent) => {
    const componentName = event.active.data.current?.componentName;
    setActiveComponentName(componentName || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;

    setActiveComponentName(null);

    if (!over) return;

    const activeData = active.data.current;

    // Dragging from library to canvas
    if (activeData?.source === 'library' && over.id === 'canvas') {
      const componentName = activeData.componentName;

      // Calculate position based on delta (where the component was dropped)
      const x = Math.max(0, delta.x);
      const y = Math.max(0, delta.y);

      // Add to canvas
      addToCanvas({
        id: `${componentName}-${Date.now()}`,
        componentName,
        position: { x, y },
      });
    }

    // Dragging from canvas to new position on canvas
    if (activeData?.source === 'canvas' && over.id === 'canvas') {
      const itemId = activeData.id;
      const item = canvasComponents.find((c) => c.id === itemId);

      if (item) {
        const newX = Math.max(0, item.position.x + delta.x);
        const newY = Math.max(0, item.position.y + delta.y);
        updatePosition(itemId, newX, newY);
      }
    }
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen bg-gray-100 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Component Builder</h1>
            <p className="text-sm text-gray-500">
              Generate components with AI, drag and drop to build your page
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPropertyPanelOpen(!isPropertyPanelOpen)}
              disabled={!selectedComponentId}
              className="px-4 py-2 bg-gray-600 text-white rounded-md font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              title={selectedComponentId ? 'Open properties panel' : 'Select a component first'}
            >
              <Settings className="w-4 h-4" />
              Properties
            </button>
            <ExportButton />
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {/* Left sidebar */}
          <div className="w-80 flex flex-col gap-4 overflow-hidden">
            <ComponentGenerator />
            <div className="flex-1 min-h-0">
              <ComponentLibrary />
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 min-w-0">
            <DragDropCanvas />
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeComponentName ? (
          <div className="px-4 py-3 bg-white border-2 border-purple-500 rounded-lg shadow-lg text-sm font-medium text-gray-900 cursor-grabbing">
            {activeComponentName}
          </div>
        ) : null}
      </DragOverlay>

      {/* Property Panel */}
      <PropertyPanel
        isOpen={isPropertyPanelOpen}
        onClose={() => setIsPropertyPanelOpen(false)}
      />
    </DndContext>
  );
}

export default App;
