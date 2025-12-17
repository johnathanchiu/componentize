import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LeftPanel } from './components/LeftPanel';
import { DragDropCanvas } from './components/DragDropCanvas';
import { ExportButton } from './components/ExportButton';
import { CodePreviewPanel } from './components/CodePreviewPanel';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { PageGenerationOverlay } from './components/page-generation';
import { useCanvasStore } from './store/canvasStore';
import { useProjectStore, type Project } from './store/projectStore';
import { useGenerationStore } from './store/generationStore';
import { getProject } from './lib/api';

function App() {
  const { clearCanvas, loadCanvas, selectedComponentId, removeFromCanvas } = useCanvasStore();
  const { currentProject, setCurrentProject } = useProjectStore();
  const { setCurrentProjectId, clearStreamingEvents } = useGenerationStore();
  const [isLoading, setIsLoading] = useState(true);

  // Read project ID from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');

    if (projectId) {
      // Load project from API
      getProject(projectId).then((result) => {
        if (result.status === 'success' && result.project) {
          setCurrentProject(result.project);
          setCurrentProjectId(projectId); // Sync generation store for session persistence
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
    setCurrentProjectId(project.id); // Sync generation store for session persistence
    loadCanvas(project.id); // Load saved canvas for this project
    // Update URL without reload
    window.history.pushState({}, '', `?project=${project.id}`);
  };

  const handleBackToProjects = () => {
    setCurrentProject(null);
    setCurrentProjectId(null); // Clear generation store project context
    clearStreamingEvents(); // Clear conversation when leaving project
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
            setCurrentProjectId(projectId);
            loadCanvas(projectId);
          }
        });
      } else {
        setCurrentProject(null);
        setCurrentProjectId(null);
        clearStreamingEvents();
        clearCanvas();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle keyboard shortcuts for selected component
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedComponentId) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          // Don't trigger if user is typing in an input
          if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
          e.preventDefault();
          removeFromCanvas(selectedComponentId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedComponentId, removeFromCanvas]);

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
        <div className="flex items-center gap-3">
          <ExportButton />
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Tabbed (Create/Library) */}
        <LeftPanel />

        {/* Canvas area - full height */}
        <div className="flex-1 min-w-0 relative">
          <DragDropCanvas />
          <PageGenerationOverlay />
        </div>

        {/* Right panel - Code preview when editing */}
        <CodePreviewPanel />
      </div>
    </div>
  );
}

export default App;
