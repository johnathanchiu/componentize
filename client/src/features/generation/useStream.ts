import { useCallback } from 'react';
import { useGenerationStore, useCurrentBlock, useGenerationActions } from './generationStore';
import { useCanvasActions } from '../canvas/canvasStore';
import { useProjectActions } from '../../store/projectStore';
import type { StreamEvent } from '@/shared/types';

/**
 * Hook for processing stream events from the server.
 * Handles delta accumulation, tool results, and canvas updates.
 */
export function useStream() {
  const currentBlock = useCurrentBlock();
  const {
    appendThinkingDelta,
    appendTextDelta,
    addToolCall,
    setToolResult,
    completeBlock,
    addUserMessage,
    startAssistantMessage,
    completeAssistantMessage,
    updateCurrentAssistantThinking,
    setAgentTodos,
    setCurrentComponentName,
    incrementComponentVersion,
    setStreamPanelExpanded,
    setGenerationMode,
    setEditingComponentName,
  } = useGenerationActions();

  const { add: addToCanvas } = useCanvasActions();
  const { addAvailableComponent } = useProjectActions();

  const processEvent = useCallback((event: StreamEvent, isCreateMode: boolean) => {
    switch (event.type) {
      case 'thinking':
        appendThinkingDelta(event.content);
        const currentThinking = useGenerationStore.getState().currentBlock?.thinking || '';
        updateCurrentAssistantThinking(currentThinking);
        break;

      case 'text':
        appendTextDelta(event.content);
        break;

      case 'tool_call':
        addToolCall(event.id, event.name, event.input || {});
        break;

      case 'tool_result':
        setToolResult(event.id, event.success ? 'success' : 'error', event.output);
        // Handle embedded canvas update from tool result
        if (event.canvas) {
          addAvailableComponent({ name: event.canvas.componentName, filepath: '' });
          addToCanvas(event.canvas);
          incrementComponentVersion(event.canvas.componentName);
          setCurrentComponentName(event.canvas.componentName);
        }
        // Handle embedded todos update from tool result
        if (event.todos) {
          setAgentTodos(event.todos);
        }
        break;

      case 'complete': {
        const block = useGenerationStore.getState().currentBlock;
        const content = block?.text || event.content || '';
        completeBlock();
        completeAssistantMessage(content);
        // Auto-collapse after success
        setTimeout(() => {
          setStreamPanelExpanded(false);
          if (!isCreateMode) {
            setGenerationMode('create');
            setEditingComponentName(null);
          }
        }, 2000);
        break;
      }

      case 'error':
        completeBlock();
        completeAssistantMessage();
        break;
    }
  }, [
    appendThinkingDelta,
    appendTextDelta,
    addToolCall,
    setToolResult,
    completeBlock,
    completeAssistantMessage,
    updateCurrentAssistantThinking,
    setAgentTodos,
    setCurrentComponentName,
    incrementComponentVersion,
    setStreamPanelExpanded,
    setGenerationMode,
    setEditingComponentName,
    addToCanvas,
    addAvailableComponent,
  ]);

  const startStream = useCallback((userPrompt: string) => {
    addUserMessage(userPrompt);
    startAssistantMessage();
  }, [addUserMessage, startAssistantMessage]);

  return {
    processEvent,
    startStream,
    currentBlock,
  };
}
