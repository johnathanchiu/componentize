import { useState, useCallback } from 'react';
import {
  useIsGenerating,
  useStreamStatus,
  useGenerationMode,
  useEditingComponentName,
  usePendingFixError,
  useAgentTodos,
  useStreamPanelExpanded,
  useCurrentComponentName,
  useConversationMessages,
  useComponentVersions,
  useGenerationActions,
} from './generationStore';
import { useStream } from './useStream';
import { useCurrentProject } from '../../store/projectStore';
import { generateStream, editProjectComponentStream } from '../../lib/api';

/**
 * Main hook for generation operations.
 * Single entry point for all generation functionality.
 *
 * Uses typed selector hooks for optimal re-rendering.
 */
export function useGeneration() {
  const [error, setError] = useState('');
  const { processEvent, startStream } = useStream();
  const currentProject = useCurrentProject();

  // Use typed selector hooks - only re-renders when specific values change
  const isGenerating = useIsGenerating();
  const streamStatus = useStreamStatus();
  const generationMode = useGenerationMode();
  const editingComponentName = useEditingComponentName();
  const pendingFixError = usePendingFixError();
  const agentTodos = useAgentTodos();
  const isStreamPanelExpanded = useStreamPanelExpanded();
  const currentComponentName = useCurrentComponentName();
  const conversationMessages = useConversationMessages();
  const componentVersions = useComponentVersions();

  // Actions are stable (functions don't change)
  const actions = useGenerationActions();

  // Core function to handle streaming response
  const handleStreamResponse = useCallback(async (
    stream: AsyncGenerator<any>,
    isCreateMode: boolean,
    userPrompt: string
  ) => {
    startStream(userPrompt);

    for await (const event of stream) {
      processEvent(event, isCreateMode);

      if (event.type === 'error') {
        setError(event.message);
        break;
      }
    }
  }, [startStream, processEvent]);

  // Generate new components
  const generate = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      setError('Please describe what you want');
      return;
    }

    if (!currentProject) {
      setError('No project selected');
      return;
    }

    setError('');
    actions.setCurrentComponentName('components');
    actions.setIsGenerating(true);
    actions.setStreamPanelExpanded(true);
    actions.setStreamStatus('thinking');

    try {
      const stream = generateStream(currentProject.id, prompt);
      await handleStreamResponse(stream, true, prompt);
    } catch (err) {
      setError('Network error. Make sure the backend server is running.');
      actions.setStreamStatus('error');
    } finally {
      actions.setIsGenerating(false);
    }
  }, [currentProject, handleStreamResponse, actions]);

  // Edit existing component
  const edit = useCallback(async (componentName: string, prompt: string) => {
    if (!prompt.trim()) {
      setError('Please describe the changes');
      return;
    }

    if (!currentProject) {
      setError('No project selected');
      return;
    }

    setError('');
    actions.setCurrentComponentName(componentName);
    actions.setIsGenerating(true);
    actions.setStreamPanelExpanded(true);
    actions.setStreamStatus('thinking');

    try {
      const stream = editProjectComponentStream(currentProject.id, componentName, prompt);
      await handleStreamResponse(stream, false, prompt);
    } catch (err) {
      setError('Network error. Make sure the backend server is running.');
      actions.setStreamStatus('error');
    } finally {
      actions.setIsGenerating(false);
    }
  }, [currentProject, handleStreamResponse, actions]);

  // Fix component errors
  const fix = useCallback(async (componentName: string, errorMessage: string, errorStack?: string) => {
    if (!currentProject) {
      setError('No project selected');
      return;
    }

    setError('');
    actions.setCurrentComponentName(componentName);
    actions.setIsGenerating(true);
    actions.setStreamPanelExpanded(true);
    actions.setStreamStatus('thinking');
    actions.setPendingFixError(null);

    const fixPrompt = `Fix this runtime error in component "${componentName}":

ERROR: ${errorMessage}

${errorStack ? `STACK TRACE:\n${errorStack}\n` : ''}
The error "${errorMessage}" typically means a variable is used but not defined. Common causes:
- Typo in variable name
- Missing import
- Using a type as a value (e.g., "string" instead of "string" type annotation)
- Variable used before declaration

Call read_component to see the code, find the bug, and call update_component with fixed code.`;

    try {
      const stream = editProjectComponentStream(currentProject.id, componentName, fixPrompt);
      await handleStreamResponse(stream, false, fixPrompt);
    } catch (err) {
      setError('Network error. Make sure the backend server is running.');
      actions.setStreamStatus('error');
    } finally {
      actions.setIsGenerating(false);
    }
  }, [currentProject, handleStreamResponse, actions]);

  // Cancel current mode
  const cancel = useCallback(() => {
    actions.setGenerationMode('create');
    actions.setEditingComponentName(null);
    setError('');
  }, [actions]);

  return {
    // State (individual values)
    isGenerating,
    streamStatus,
    generationMode,
    editingComponentName,
    pendingFixError,
    agentTodos,
    isStreamPanelExpanded,
    currentComponentName,
    conversationMessages,
    componentVersions,
    error,

    // Actions
    generate,
    edit,
    fix,
    cancel,
    startEditing: actions.startEditing,
    startFixing: actions.startFixing,
    resetGenerationUI: actions.resetGenerationUI,
    incrementComponentVersion: actions.incrementComponentVersion,
    loadConversationFromHistory: actions.loadConversationFromHistory,
    clearConversation: actions.clearConversation,
    setError,

    // UI actions
    setStreamPanelExpanded: actions.setStreamPanelExpanded,
    setGenerationMode: actions.setGenerationMode,
    setEditingComponentName: actions.setEditingComponentName,
    setPendingFixError: actions.setPendingFixError,
    setCurrentComponentName: actions.setCurrentComponentName,
  };
}

/**
 * Hook for accessing generation status only.
 * Use when you only need to check if generating.
 */
export function useGenerationStatus() {
  const isGenerating = useIsGenerating();
  const streamStatus = useStreamStatus();
  const generationMode = useGenerationMode();
  return { isGenerating, streamStatus, generationMode };
}
