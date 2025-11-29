import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { Settings } from 'lucide-react';
import { ComponentLibrary } from './components/ComponentLibrary';
import { DragDropCanvas } from './components/DragDropCanvas';
import { ExportButton } from './components/ExportButton';
import { PropertyPanel } from './components/PropertyPanel';
import { GenerationPanel } from './components/GenerationPanel';
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
      <div className="h-screen bg-neutral-100 flex flex-col">
        {/* Header - minimal */}
        <header className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Componentize
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPropertyPanelOpen(!isPropertyPanelOpen)}
              disabled={!selectedComponentId}
              className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              title={selectedComponentId ? 'Open properties panel' : 'Select a component first'}
            >
              <Settings className="w-4 h-4" />
              Properties
            </button>
            <ExportButton />
          </div>
        </header>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar - Components Library only */}
          <div className="w-64 border-r border-neutral-200 bg-white flex flex-col">
            <ComponentLibrary />
          </div>

          {/* Canvas area */}
          <div className="flex-1 min-w-0">
            <DragDropCanvas />
          </div>
        </div>

        {/* Bottom panel - Generation interface */}
        <GenerationPanel />
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeComponentName ? (
          <div className="px-4 py-2.5 bg-white border-2 border-neutral-900 rounded-lg shadow-lg text-sm font-medium text-neutral-900 cursor-grabbing">
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
