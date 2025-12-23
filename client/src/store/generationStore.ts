import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { StreamEvent, ComponentPlan, CanvasComponent } from '../types/index';

// Page generation status
export type PageGenerationStatus = 'idle' | 'modal' | 'planning' | 'generating' | 'complete' | 'error';

interface PageGenerationStore {
  // Page generation state
  pageStatus: PageGenerationStatus;
  pagePlan: ComponentPlan[] | null;
  pageCurrentComponentIndex: number;
  pageTotalComponents: number;
  pageCompletedComponents: string[];
  pageFailedComponents: Array<{ name: string; error: string }>;
  pageCanvasComponents: CanvasComponent[];
  pageEvents: StreamEvent[];
  pageCurrentThinking: string;

  // Page generation actions
  pageOpenModal: () => void;
  pageCloseModal: () => void;
  pageStartGeneration: () => void;
  pageSetPlan: (plan: ComponentPlan[], total: number) => void;
  pageSetCurrentComponent: (index: number, name: string) => void;
  pageAddThinking: (text: string) => void;
  pageMarkComponentComplete: (name: string, canvasComponent?: CanvasComponent) => void;
  pageMarkComponentFailed: (name: string, error: string) => void;
  pageAddEvent: (event: StreamEvent) => void;
  pageComplete: () => void;
  pageSetError: (message: string) => void;
  pageReset: () => void;
}

export const usePageGenerationStore = create<PageGenerationStore>()(
  persist(
    (set) => ({
      // Page generation state
      pageStatus: 'idle',
      pagePlan: null,
      pageCurrentComponentIndex: 0,
      pageTotalComponents: 0,
      pageCompletedComponents: [],
      pageFailedComponents: [],
      pageCanvasComponents: [],
      pageEvents: [],
      pageCurrentThinking: '',

      // Page generation actions
      pageOpenModal: () => set({ pageStatus: 'modal' }),

      pageCloseModal: () => set({ pageStatus: 'idle' }),

      pageStartGeneration: () => set({
        pageStatus: 'planning',
        pagePlan: null,
        pageCurrentComponentIndex: 0,
        pageTotalComponents: 0,
        pageCompletedComponents: [],
        pageFailedComponents: [],
        pageCanvasComponents: [],
        pageEvents: [],
        pageCurrentThinking: '',
      }),

      pageSetPlan: (plan, total) => set({
        pageStatus: 'generating',
        pagePlan: plan,
        pageTotalComponents: total,
      }),

      pageSetCurrentComponent: (index, name) => set({
        pageCurrentComponentIndex: index,
        pageCurrentThinking: `Creating ${name}...`,
      }),

      pageAddThinking: (text) => set({ pageCurrentThinking: text }),

      pageMarkComponentComplete: (name, canvasComponent) => set((state) => ({
        pageCompletedComponents: [...state.pageCompletedComponents, name],
        pageCanvasComponents: canvasComponent
          ? [...state.pageCanvasComponents, canvasComponent]
          : state.pageCanvasComponents,
      })),

      pageMarkComponentFailed: (name, error) => set((state) => ({
        pageFailedComponents: [...state.pageFailedComponents, { name, error }],
      })),

      pageAddEvent: (event) => set((state) => ({
        pageEvents: [...state.pageEvents, event],
      })),

      pageComplete: () => set({ pageStatus: 'complete' }),

      pageSetError: (message) => set({
        pageStatus: 'error',
        pageCurrentThinking: message,
      }),

      pageReset: () => set({
        pageStatus: 'idle',
        pagePlan: null,
        pageCurrentComponentIndex: 0,
        pageTotalComponents: 0,
        pageCompletedComponents: [],
        pageFailedComponents: [],
        pageCanvasComponents: [],
        pageEvents: [],
        pageCurrentThinking: '',
      }),
    }),
    {
      name: 'componentize-page-generation',
      partialize: () => ({}), // Don't persist page generation state
    }
  )
);

// ============================================================================
// Selector Hooks - Use these instead of destructuring the store directly
// ============================================================================

// State selectors (one per value - only re-renders when that value changes)
export const usePageStatus = () => usePageGenerationStore((s) => s.pageStatus);
export const usePagePlan = () => usePageGenerationStore((s) => s.pagePlan);
export const usePageCurrentComponentIndex = () => usePageGenerationStore((s) => s.pageCurrentComponentIndex);
export const usePageTotalComponents = () => usePageGenerationStore((s) => s.pageTotalComponents);
export const usePageCompletedComponents = () => usePageGenerationStore((s) => s.pageCompletedComponents);
export const usePageFailedComponents = () => usePageGenerationStore((s) => s.pageFailedComponents);
export const usePageCanvasComponents = () => usePageGenerationStore((s) => s.pageCanvasComponents);
export const usePageEvents = () => usePageGenerationStore((s) => s.pageEvents);
export const usePageCurrentThinking = () => usePageGenerationStore((s) => s.pageCurrentThinking);

// Convenience selector for progress tracking (use useShallow for object)
export const usePageProgress = () => usePageGenerationStore(
  useShallow((s) => ({
    currentIndex: s.pageCurrentComponentIndex,
    total: s.pageTotalComponents,
    completed: s.pageCompletedComponents,
    failed: s.pageFailedComponents,
  }))
);

// Actions (grouped - use useShallow to prevent infinite loops from object creation)
export const usePageGenerationActions = () => usePageGenerationStore(
  useShallow((s) => ({
    pageOpenModal: s.pageOpenModal,
    pageCloseModal: s.pageCloseModal,
    pageStartGeneration: s.pageStartGeneration,
    pageSetPlan: s.pageSetPlan,
    pageSetCurrentComponent: s.pageSetCurrentComponent,
    pageAddThinking: s.pageAddThinking,
    pageMarkComponentComplete: s.pageMarkComponentComplete,
    pageMarkComponentFailed: s.pageMarkComponentFailed,
    pageAddEvent: s.pageAddEvent,
    pageComplete: s.pageComplete,
    pageSetError: s.pageSetError,
    pageReset: s.pageReset,
  }))
);
