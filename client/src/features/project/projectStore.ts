import { create } from 'zustand';
import type { Component } from '@/shared/types';
import type { PageStyle } from '../../types/index';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pageStyle?: PageStyle;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  availableComponents: Component[];
}

interface ProjectActions {
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setCurrentProject: (project: Project | null) => void;
  setIsLoading: (loading: boolean) => void;
  setAvailableComponents: (components: Component[]) => void;
  addAvailableComponent: (component: Component) => void;
  removeAvailableComponent: (componentName: string) => void;
  setPageStyle: (pageStyle: PageStyle) => void;
}

export type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>((set) => ({
  // State
  projects: [],
  currentProject: null,
  isLoading: false,
  availableComponents: [],

  // Actions
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

  setIsLoading: (loading) => set({ isLoading: loading }),

  setAvailableComponents: (components) => set({ availableComponents: components }),

  addAvailableComponent: (component) =>
    set((state) => ({
      availableComponents: [...state.availableComponents, component],
    })),

  removeAvailableComponent: (componentName) =>
    set((state) => ({
      availableComponents: state.availableComponents.filter((c) => c.name !== componentName),
    })),

  setPageStyle: (pageStyle) =>
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, pageStyle }
        : null,
    })),
}));
