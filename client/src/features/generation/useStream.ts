import { useCallback } from 'react';
import { useCurrentBlock, useGenerationActions } from './generationStore';
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
    addUserMessage,
    startAssistantMessage,
    completeAssistantMessage,
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
        completeAssistantMessage();
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
        completeAssistantMessage();
        break;
    }
  }, [
    appendThinkingDelta,
    appendTextDelta,
    addToolCall,
    setToolResult,
    completeAssistantMessage,
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
