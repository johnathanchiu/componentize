import { create } from 'zustand';
import type { Component, PageStyle } from '../types/index';

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
