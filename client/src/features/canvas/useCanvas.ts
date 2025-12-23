import { useMemo } from 'react';
import {
  useCanvasStore,
  useCanvasComponents,
  useSelectedId,
  useConnections,
  useShowConnections,
  useCanvasIsLoading,
  useCanvasLoadError,
  useCanvasProjectId,
  useCanvasActions,
} from './canvasStore';

/**
 * Main hook for canvas operations.
 * Single entry point for all canvas functionality.
 *
 * @deprecated Prefer using individual selector hooks from canvasStore.ts
 */
export function useCanvas() {
  const components = useCanvasComponents();
  const selectedId = useSelectedId();
  const connections = useConnections();
  const showConnections = useShowConnections();
  const isLoading = useCanvasIsLoading();
  const loadError = useCanvasLoadError();
  const projectId = useCanvasProjectId();
  const actions = useCanvasActions();

  // Access history from store for canUndo/canRedo
  const history = useCanvasStore((s) => s.history);
  const future = useCanvasStore((s) => s.future);

  // Derived state
  const selectedComponent = useMemo(
    () => components.find((c) => c.id === selectedId) ?? null,
    [components, selectedId]
  );

  const canUndo = history.length > 0;
  const canRedo = future.length > 0;
  const hasComponents = components.length > 0;
  const hasConnections = connections.length > 0;

  return {
    // State
    components,
    selectedId,
    selectedComponent,
    isLoading,
    loadError,
    projectId,

    // History state
    canUndo,
    canRedo,

    // Connections state
    connections,
    showConnections,
    hasConnections,
    hasComponents,

    // Actions
    add: actions.add,
    remove: actions.remove,
    move: actions.updatePosition,
    resize: actions.updateSize,
    clearSize: actions.clearSize,
    clear: actions.clear,

    // Selection
    select: actions.select,

    // History
    undo: actions.undo,
    redo: actions.redo,
    pushToHistory: actions.pushToHistory,

    // Connections
    setConnections: actions.setConnections,
    addConnections: actions.addConnections,
    removeComponentConnections: actions.removeComponentConnections,
    toggleConnections: actions.toggleConnections,
    setShowConnections: actions.setShowConnections,

    // Project
    setComponents: actions.setComponents,
    setProjectId: actions.setProjectId,
  };
}

/**
 * Hook for canvas selection state only.
 * Use when you only need selection, not full canvas.
 */
export function useCanvasSelection() {
  const selectedId = useSelectedId();
  const components = useCanvasComponents();
  const { select } = useCanvasActions();

  const selectedComponent = useMemo(
    () => components.find((c) => c.id === selectedId) ?? null,
    [components, selectedId]
  );

  return {
    selectedId,
    selectedComponent,
    select,
  };
}
