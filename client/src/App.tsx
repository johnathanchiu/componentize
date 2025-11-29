import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { LeftPanel } from './components/LeftPanel';
import { DragDropCanvas } from './components/DragDropCanvas';
import { ExportButton } from './components/ExportButton';
import { CodePreviewPanel } from './components/CodePreviewPanel';
import { useCanvasStore } from './store/canvasStore';

function App() {
  const { addToCanvas, updatePosition, canvasComponents } = useCanvasStore();
  const [activeComponentName, setActiveComponentName] = useState<string | null>(null);

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
          <ExportButton />
        </header>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel - Tabbed (Create/Library) */}
          <LeftPanel />

          {/* Canvas area - full height */}
          <div className="flex-1 min-w-0">
            <DragDropCanvas />
          </div>

          {/* Right panel - Code preview when editing */}
          <CodePreviewPanel />
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeComponentName ? (
          <div className="px-4 py-2.5 bg-white border-2 border-neutral-900 rounded-lg shadow-lg text-sm font-medium text-neutral-900 cursor-grabbing">
            {activeComponentName}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
