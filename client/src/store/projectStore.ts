import { create } from 'zustand';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectStore {
  // State
  projects: Project[];
  currentProject: Project | null;
  isLoadingProjects: boolean;

  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setCurrentProject: (project: Project | null) => void;
  setIsLoadingProjects: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  // Initial state
  projects: [],
  currentProject: null,
  isLoadingProjects: false,

  // Actions
  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => ({
      projects: [project, ...state.projects],
    })),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      // Clear current project if it was deleted
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    })),

  setCurrentProject: (project) => set({ currentProject: project }),

  setIsLoadingProjects: (loading) => set({ isLoadingProjects: loading }),
}));
