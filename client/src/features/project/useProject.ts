import { useCallback } from 'react';
import { useProjectStore, type Project } from './projectStore';
import {
  listProjects,
  createProject,
  deleteProject as apiDeleteProject,
  getProject,
} from '../../lib/api';
import { useGenerationStore } from '../generation/generationStore';
import { useCanvasStore } from '../canvas/canvasStore';

/**
 * Main hook for project operations.
 * Single entry point for all project functionality.
 */
export function useProject() {
  const store = useProjectStore();
  const { setCurrentProjectId, loadConversationFromHistory, clearConversation } = useGenerationStore();
  const { setComponents: setCanvasComponents, setProjectId: setCanvasProjectId } = useCanvasStore();

  // Load all projects
  const loadProjects = useCallback(async () => {
    store.setIsLoading(true);
    try {
      const result = await listProjects();
      store.setProjects(result.projects);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      store.setIsLoading(false);
    }
  }, [store]);

  // Create a new project
  const create = useCallback(async (name: string): Promise<Project | null> => {
    try {
      const result = await createProject(name);
      store.addProject(result.project);
      return result.project;
    } catch (err) {
      console.error('Failed to create project:', err);
      return null;
    }
  }, [store]);

  // Delete a project
  const remove = useCallback(async (id: string) => {
    try {
      await apiDeleteProject(id);
      store.removeProject(id);
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  }, [store]);

  // Select a project and load its data
  const select = useCallback(async (project: Project | null) => {
    store.setCurrentProject(project);

    if (project) {
      // Set project ID in related stores
      setCurrentProjectId(project.id);
      setCanvasProjectId(project.id);

      // Load project data
      try {
        const projectData = await getProject(project.id);
        store.setAvailableComponents(projectData.components);
        setCanvasComponents(projectData.canvas, project.id);

        // Load conversation history if available
        if (projectData.history) {
          loadConversationFromHistory(projectData.history);
        } else {
          clearConversation();
        }
      } catch (err) {
        console.error('Failed to load project data:', err);
      }
    } else {
      setCurrentProjectId(null);
      setCanvasProjectId(null);
      clearConversation();
    }
  }, [store, setCurrentProjectId, setCanvasProjectId, setCanvasComponents, loadConversationFromHistory, clearConversation]);

  return {
    // State
    projects: store.projects,
    currentProject: store.currentProject,
    isLoading: store.isLoading,
    availableComponents: store.availableComponents,

    // Actions
    loadProjects,
    create,
    remove,
    select,
    setAvailableComponents: store.setAvailableComponents,
    addAvailableComponent: store.addAvailableComponent,
    removeAvailableComponent: store.removeAvailableComponent,
    setPageStyle: store.setPageStyle,
  };
}

/**
 * Hook for accessing current project only.
 */
export function useCurrentProject() {
  return {
    project: useProjectStore((s) => s.currentProject),
    setProject: useProjectStore((s) => s.setCurrentProject),
  };
}
