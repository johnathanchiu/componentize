import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Component } from '@/shared/types';
import type { PageStyle } from '../types/index';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pageStyle?: PageStyle;
}

interface ProjectStore {
  // Project state
  projects: Project[];
  currentProject: Project | null;
  isLoadingProjects: boolean;

  // Component library state (moved from componentLibraryStore)
  availableComponents: Component[];

  // Project actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setCurrentProject: (project: Project | null) => void;
  setIsLoadingProjects: (loading: boolean) => void;

  // Component library actions
  setAvailableComponents: (components: Component[]) => void;
  addAvailableComponent: (component: Component) => void;
  removeAvailableComponent: (componentName: string) => void;

  // Page style actions
  setPageStyle: (pageStyle: PageStyle) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  // Initial state
  projects: [],
  currentProject: null,
  isLoadingProjects: false,
  availableComponents: [],

  // Project actions
  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => ({
      projects: [project, ...state.projects],
    })),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    })),

  setCurrentProject: (project) => set({ currentProject: project }),

  setIsLoadingProjects: (loading) => set({ isLoadingProjects: loading }),

  // Component library actions
  setAvailableComponents: (components) => set({ availableComponents: components }),

  addAvailableComponent: (component) =>
    set((state) => ({
      availableComponents: [...state.availableComponents, component],
    })),

  removeAvailableComponent: (componentName) =>
    set((state) => ({
      availableComponents: state.availableComponents.filter((c) => c.name !== componentName),
    })),

  // Page style actions
  setPageStyle: (pageStyle) =>
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, pageStyle }
        : null,
    })),
}));

// ============================================================================
// Selector Hooks - Use these instead of destructuring the store directly
// ============================================================================

// State selectors (one per value - only re-renders when that value changes)
export const useProjects = () => useProjectStore((s) => s.projects);
export const useCurrentProject = () => useProjectStore((s) => s.currentProject);
export const useIsLoadingProjects = () => useProjectStore((s) => s.isLoadingProjects);
export const useAvailableComponents = () => useProjectStore((s) => s.availableComponents);

// Actions (grouped - use useShallow to prevent infinite loops from object creation)
export const useProjectActions = () => useProjectStore(
  useShallow((s) => ({
    setProjects: s.setProjects,
    addProject: s.addProject,
    removeProject: s.removeProject,
    setCurrentProject: s.setCurrentProject,
    setIsLoadingProjects: s.setIsLoadingProjects,
    setAvailableComponents: s.setAvailableComponents,
    addAvailableComponent: s.addAvailableComponent,
    removeAvailableComponent: s.removeAvailableComponent,
    setPageStyle: s.setPageStyle,
  }))
);
