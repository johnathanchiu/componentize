import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LeftPanel } from './components/LeftPanel';
import { DragDropCanvas } from './components/DragDropCanvas';
import { ExportButton } from './components/ExportButton';
import { CodePreviewPanel } from './components/CodePreviewPanel';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { useCanvasStore } from './store/canvasStore';
import { useProjectStore, type Project } from './store/projectStore';
import { getProject } from './lib/api';

function App() {
  const { addToCanvas, updatePosition, canvasComponents, clearCanvas, loadCanvas } = useCanvasStore();
  const { currentProject, setCurrentProject } = useProjectStore();
  const [activeComponentName, setActiveComponentName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastPointerPosition = useRef<{ x: number; y: number } | null>(null);

  // Configure sensors with custom activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts
      },
    })
  );

  // Read project ID from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');

    if (projectId) {
      // Load project from API
      getProject(projectId).then((result) => {
        if (result.status === 'success' && result.project) {
          setCurrentProject(result.project);
          loadCanvas(projectId); // Load saved canvas for this project
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  // Update URL when project changes
  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    loadCanvas(project.id); // Load saved canvas for this project
    // Update URL without reload
    window.history.pushState({}, '', `?project=${project.id}`);
  };

  const handleBackToProjects = () => {
    setCurrentProject(null);
    clearCanvas();
    // Update URL without reload
    window.history.pushState({}, '', '/');
  };

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get('project');

      if (projectId) {
        getProject(projectId).then((result) => {
          if (result.status === 'success' && result.project) {
            setCurrentProject(result.project);
            loadCanvas(projectId);
          }
        });
      } else {
        setCurrentProject(null);
        clearCanvas();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const componentName = event.active.data.current?.componentName;
    setActiveComponentName(componentName || null);
  };

  const handleDragMove = (event: any) => {
    // Track the current pointer position for accurate drop placement
    if (event.activatorEvent) {
      const pointerEvent = event.activatorEvent as PointerEvent;
      lastPointerPosition.current = {
        x: pointerEvent.clientX + event.delta.x,
        y: pointerEvent.clientY + event.delta.y,
      };
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;

    setActiveComponentName(null);

    if (!over) return;

    const activeData = active.data.current;

    // Dragging from library to canvas
    if (activeData?.source === 'library' && over.id === 'canvas') {
      const componentName = activeData.componentName;

      // Get the canvas element's bounding rect to calculate relative position
      const canvasElement = document.querySelector('[data-canvas="true"]');
      if (canvasElement && lastPointerPosition.current) {
        const canvasRect = canvasElement.getBoundingClientRect();
        const scrollLeft = canvasElement.scrollLeft;
        const scrollTop = canvasElement.scrollTop;

        // Calculate position relative to the canvas, accounting for scroll
        const x = Math.max(0, lastPointerPosition.current.x - canvasRect.left + scrollLeft);
        const y = Math.max(0, lastPointerPosition.current.y - canvasRect.top + scrollTop);

        addToCanvas({
          id: `${componentName}-${Date.now()}`,
          componentName,
          position: { x, y },
        });
      } else {
        // Fallback: place at a default position
        addToCanvas({
          id: `${componentName}-${Date.now()}`,
          componentName,
          position: { x: 50, y: 50 },
        });
      }
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

    lastPointerPosition.current = null;
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  // Show projects page when no project selected
  if (!currentProject) {
    return <ProjectsPage onOpenProject={handleOpenProject} />;
  }

  // Show editor with current project
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
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
              {currentProject.name}
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
