import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Sidebar } from './features/sidebar';
import { Canvas, useCanvasActions } from './features/canvas';
import { useGenerationActions } from './features/generation';
import { ExportButton } from './components/ExportButton';
import { CodePreviewPanel } from './components/CodePreviewPanel';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { PageGenerationOverlay } from './components/page-generation';
import { useCurrentProject, useProjectActions, type Project } from './store/projectStore';
import { useBlockAccumulator } from './hooks/useBlockAccumulator';
import { getProject } from './lib/api';

function App() {
  const { clear: clearCanvas, setComponents: setCanvasComponents } = useCanvasActions();
  const currentProject = useCurrentProject();
  const { setCurrentProject, setAvailableComponents } = useProjectActions();
  // Use typed selector hooks for optimal re-rendering
  const { setCurrentProjectId, clearConversation, loadConversationFromHistory } = useGenerationActions();
  const { resumeStream } = useBlockAccumulator();
  const [isLoading, setIsLoading] = useState(true);

  // Helper to load project with all data
  const loadProjectData = async (projectId: string) => {
    try {
      const result = await getProject(projectId);
      setCurrentProject(result.project);
      setCurrentProjectId(projectId);
      setCanvasComponents(result.canvas || [], projectId);
      setAvailableComponents(result.components || []);

      // ALWAYS load history from disk first (completed turns)
      if (result.history && result.history.length > 0) {
        loadConversationFromHistory(result.history);
      }

      // THEN if task is running, resume stream (appends in-progress events)
      // Disk and buffer are mutually exclusive - disk has past, buffer has present
      if (result.taskStatus === 'running') {
        setTimeout(() => {
          resumeStream(projectId);
        }, 100);
      }

      return result;
    } catch (error) {
      console.error('Failed to load project:', error);
      return null;
    }
  };

  // Read project ID from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');

    if (projectId) {
      loadProjectData(projectId).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Update URL when project changes
  const handleOpenProject = (project: Project) => {
    loadProjectData(project.id);
    window.history.pushState({}, '', `?project=${project.id}`);
  };

  const handleBackToProjects = () => {
    setCurrentProject(null);
    setCurrentProjectId(null);
    clearConversation();
    clearCanvas();
    window.history.pushState({}, '', '/');
  };

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get('project');

      if (projectId) {
        loadProjectData(projectId);
      } else {
        setCurrentProject(null);
        setCurrentProjectId(null);
        clearConversation();
        clearCanvas();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!currentProject) {
    return <ProjectsPage onOpenProject={handleOpenProject} />;
  }

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
        <Sidebar />

        {/* Canvas area */}
        <div className="flex-1 min-w-0 relative">
          <Canvas />
          <PageGenerationOverlay />
        </div>

        {/* Right panel - Code preview when editing */}
        <CodePreviewPanel />
      </div>
    </div>
  );
}

export default App;
