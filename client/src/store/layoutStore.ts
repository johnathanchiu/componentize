import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { LayoutState, PageStyle, Section, Layer } from '@/shared/types';

// Default layout state
const DEFAULT_LAYOUT: LayoutState = {
  pageStyle: {
    width: 1200,
    background: '#ffffff',
  },
  sections: [],
  layers: [],
};

interface LayoutStore {
  // State
  layout: LayoutState;

  // Actions
  setLayout: (layout: LayoutState) => void;
  updatePageStyle: (style: Partial<PageStyle>) => void;
  addSection: (section: Section) => void;
  updateSection: (name: string, updates: Partial<Section>) => void;
  removeSection: (name: string) => void;
  reorderSections: (names: string[]) => void;
  addLayer: (layer: Layer) => void;
  removeLayer: (name: string) => void;
  reset: () => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  // Initial state
  layout: DEFAULT_LAYOUT,

  // Set entire layout (from API)
  setLayout: (layout) => set({ layout }),

  // Update page style
  updatePageStyle: (style) =>
    set((state) => ({
      layout: {
        ...state.layout,
        pageStyle: { ...state.layout.pageStyle, ...style },
      },
    })),

  // Add a section
  addSection: (section) =>
    set((state) => ({
      layout: {
        ...state.layout,
        sections: [...state.layout.sections, section],
      },
    })),

  // Update a section by name
  updateSection: (name, updates) =>
    set((state) => ({
      layout: {
        ...state.layout,
        sections: state.layout.sections.map((s) =>
          s.name === name ? { ...s, ...updates } : s
        ),
      },
    })),

  // Remove a section
  removeSection: (name) =>
    set((state) => ({
      layout: {
        ...state.layout,
        sections: state.layout.sections.filter((s) => s.name !== name),
      },
    })),

  // Reorder sections
  reorderSections: (names) =>
    set((state) => {
      const sectionMap = new Map(state.layout.sections.map((s) => [s.name, s]));
      const reordered = names
        .map((name) => sectionMap.get(name))
        .filter((s): s is Section => s !== undefined);
      return {
        layout: {
          ...state.layout,
          sections: reordered,
        },
      };
    }),

  // Add a layer
  addLayer: (layer) =>
    set((state) => ({
      layout: {
        ...state.layout,
        layers: [...state.layout.layers, layer],
      },
    })),

  // Remove a layer
  removeLayer: (name) =>
    set((state) => ({
      layout: {
        ...state.layout,
        layers: state.layout.layers.filter((l) => l.name !== name),
      },
    })),

  // Reset to default
  reset: () => set({ layout: DEFAULT_LAYOUT }),
}));

// ============================================================================
// Selector Hooks
// ============================================================================

// Full layout
export const useLayout = () => useLayoutStore((s) => s.layout);

// Individual pieces
export const usePageStyle = () => useLayoutStore((s) => s.layout.pageStyle);
export const useSections = () => useLayoutStore((s) => s.layout.sections);
export const useLayers = () => useLayoutStore((s) => s.layout.layers);

// Actions (grouped)
export const useLayoutActions = () =>
  useLayoutStore(
    useShallow((s) => ({
      setLayout: s.setLayout,
      updatePageStyle: s.updatePageStyle,
      addSection: s.addSection,
      updateSection: s.updateSection,
      removeSection: s.removeSection,
      reorderSections: s.reorderSections,
      addLayer: s.addLayer,
      removeLayer: s.removeLayer,
      reset: s.reset,
    }))
  );
