import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LeftPanel } from './components/LeftPanel';
import { DragDropCanvas } from './components/DragDropCanvas';
import { ExportButton } from './components/ExportButton';
import { CodePreviewPanel } from './components/CodePreviewPanel';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { useCanvasStore } from './store/canvasStore';
import { useProjectStore, type Project } from './store/projectStore';

type View = 'projects' | 'editor';

function App() {
  const { addToCanvas, updatePosition, canvasComponents, clearCanvas } = useCanvasStore();
  const { currentProject, setCurrentProject } = useProjectStore();
  const [view, setView] = useState<View>('projects');
  const [activeComponentName, setActiveComponentName] = useState<string | null>(null);

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    clearCanvas();
    setView('editor');
  };

  const handleBackToProjects = () => {
    setView('projects');
    setCurrentProject(null);
    clearCanvas();
  };

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

  // Show projects page
  if (view === 'projects') {
    return <ProjectsPage onOpenProject={handleOpenProject} />;
  }

  // Show editor with current project
  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen bg-neutral-100 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToProjects}
              className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Projects</span>
            </button>
            <div className="h-4 w-px bg-neutral-200" />
            <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">
              {currentProject?.name || 'Componentize'}
            </h1>
          </div>
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
