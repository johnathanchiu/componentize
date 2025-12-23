import { useCallback } from 'react';
import { useLibraryComponents, useBrokenComponents, useLibraryActions } from './libraryStore';
import { useCurrentProject, useProjectActions } from '../../store/projectStore';
import { useGenerationActions } from '../generation/generationStore';
import { getProject, deleteProjectComponent } from '../../lib/api';

/**
 * Main hook for library operations.
 * Single entry point for all library functionality.
 */
export function useLibrary() {
  // Use typed selector hooks for optimal re-rendering
  const components = useLibraryComponents();
  const brokenComponents = useBrokenComponents();
  const {
    setComponents,
    addComponent,
    removeComponent,
    setBroken,
    clearBroken,
  } = useLibraryActions();

  const currentProject = useCurrentProject();
  const { setAvailableComponents } = useProjectActions();
  const { startFixing } = useGenerationActions();

  const brokenCount = brokenComponents.size;
  const hasComponents = components.length > 0;

  // Refresh component list from server
  const refresh = useCallback(async () => {
    if (!currentProject) return;

    try {
      const result = await getProject(currentProject.id);
      setComponents(result.components);
      setAvailableComponents(result.components);
    } catch (err) {
      console.error('Failed to load components:', err);
    }
  }, [currentProject, setComponents, setAvailableComponents]);

  // Delete a component
  const deleteComponent = useCallback(async (componentName: string) => {
    if (!currentProject) return;
    if (!window.confirm(`Delete "${componentName}"? This cannot be undone.`)) return;

    try {
      await deleteProjectComponent(currentProject.id, componentName);
      removeComponent(componentName);
    } catch (err) {
      console.error('Failed to delete component:', err);
    }
  }, [currentProject, removeComponent]);

  // Fix a broken component
  const fixComponent = useCallback((componentName: string, error: string) => {
    startFixing(componentName, { message: error });
  }, [startFixing]);

  // Fix all broken components
  const fixAll = useCallback(() => {
    const brokenList = Array.from(brokenComponents.entries());
    if (brokenList.length === 0) return;

    const [firstName, firstError] = brokenList[0];
    startFixing(firstName, { message: firstError });
  }, [brokenComponents, startFixing]);

  // Report component error
  const reportError = useCallback((componentName: string, error: string) => {
    setBroken(componentName, error);
  }, [setBroken]);

  // Report component success (clear error)
  const reportSuccess = useCallback((componentName: string) => {
    clearBroken(componentName);
  }, [clearBroken]);

  return {
    // State
    components,
    brokenComponents,
    brokenCount,
    hasComponents,

    // Actions
    refresh,
    deleteComponent,
    fixComponent,
    fixAll,
    reportError,
    reportSuccess,
    setComponents,
    addComponent,
    removeComponent,
  };
}
