import { useState, useEffect } from 'react';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { EditorPage } from '@/pages/EditorPage';
import { useCanvasActions } from '@/store/canvasStore';
import { useGenerationActions } from '@/store/generationStore';
import { useCurrentProject, useProjectActions, type Project } from '@/store/projectStore';
import { useLayoutActions } from '@/store/layoutStore';
import { useBlockAccumulator } from '@/hooks/useBlockAccumulator';
import { getProject } from '@/lib/api';

function App() {
  const { clear: clearCanvas, setComponents: setCanvasComponents } = useCanvasActions();
  const currentProject = useCurrentProject();
  const { setCurrentProject, setAvailableComponents } = useProjectActions();
  const { setLayout, reset: resetLayout } = useLayoutActions();
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

      // Load layout state (sections, layers, pageStyle)
      if (result.layout) {
        setLayout(result.layout);
      }

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
    resetLayout();
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
        resetLayout();
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

  return <EditorPage project={currentProject} onBack={handleBackToProjects} />;
}

export default App;
