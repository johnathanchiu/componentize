import { create } from 'zustand';
import type { ComponentPlan, CanvasComponent, StreamEvent } from '../types';

export type PageGenerationStatus = 'idle' | 'modal' | 'planning' | 'generating' | 'complete' | 'error';

interface PageGenerationState {
  // Status
  status: PageGenerationStatus;

  // Plan
  plan: ComponentPlan[] | null;
  currentComponentIndex: number;
  totalComponents: number;

  // Generated components
  completedComponents: string[];
  failedComponents: Array<{ name: string; error: string }>;
  canvasComponents: CanvasComponent[];

  // Timeline
  events: StreamEvent[];
  currentThinking: string;

  // Actions
  openModal: () => void;
  closeModal: () => void;
  startGeneration: () => void;
  setPlan: (plan: ComponentPlan[], total: number) => void;
  setCurrentComponent: (index: number, name: string) => void;
  addThinking: (text: string) => void;
  markComponentComplete: (name: string, canvasComponent?: CanvasComponent) => void;
  markComponentFailed: (name: string, error: string) => void;
  addEvent: (event: StreamEvent) => void;
  complete: () => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const usePageGenerationStore = create<PageGenerationState>((set) => ({
  // Initial state
  status: 'idle',
  plan: null,
  currentComponentIndex: 0,
  totalComponents: 0,
  completedComponents: [],
  failedComponents: [],
  canvasComponents: [],
  events: [],
  currentThinking: '',

  // Actions
  openModal: () => set({ status: 'modal' }),

  closeModal: () => set({ status: 'idle' }),

  startGeneration: () => set({
    status: 'planning',
    plan: null,
    currentComponentIndex: 0,
    totalComponents: 0,
    completedComponents: [],
    failedComponents: [],
    canvasComponents: [],
    events: [],
    currentThinking: '',
  }),

  setPlan: (plan, total) => set({
    status: 'generating',
    plan,
    totalComponents: total,
  }),

  setCurrentComponent: (index, name) => set({
    currentComponentIndex: index,
    currentThinking: `Creating ${name}...`,
  }),

  addThinking: (text) => set({
    currentThinking: text,
  }),

  markComponentComplete: (name, canvasComponent) => set((state) => ({
    completedComponents: [...state.completedComponents, name],
    canvasComponents: canvasComponent
      ? [...state.canvasComponents, canvasComponent]
      : state.canvasComponents,
  })),

  markComponentFailed: (name, error) => set((state) => ({
    failedComponents: [...state.failedComponents, { name, error }],
  })),

  addEvent: (event) => set((state) => ({
    events: [...state.events, event],
  })),

  complete: () => set({ status: 'complete' }),

  setError: (message) => set({
    status: 'error',
    currentThinking: message,
  }),

  reset: () => set({
    status: 'idle',
    plan: null,
    currentComponentIndex: 0,
    totalComponents: 0,
    completedComponents: [],
    failedComponents: [],
    canvasComponents: [],
    events: [],
    currentThinking: '',
  }),
}));
