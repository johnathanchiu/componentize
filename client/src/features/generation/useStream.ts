import { useCallback } from 'react';
import { useGenerationStore, useCurrentBlock, useGenerationActions } from './generationStore';
import { useCanvasActions } from '../canvas/canvasStore';
import { useProjectActions } from '../../store/projectStore';
import type { StreamEvent } from '../../types/index';

/**
 * Hook for processing stream events from the server.
 * Handles delta accumulation, tool results, and canvas updates.
 */
export function useStream() {
  const currentBlock = useCurrentBlock();
  const {
    startNewBlock,
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
      case 'turn_start':
        startNewBlock();
        break;

      case 'thinking_delta':
        if (event.data?.content) {
          appendThinkingDelta(event.data.content);
          const currentThinking = useGenerationStore.getState().currentBlock?.thinking || '';
          updateCurrentAssistantThinking(currentThinking);
        }
        break;

      case 'text_delta':
        if (event.data?.content) {
          appendTextDelta(event.data.content);
        }
        break;

      case 'tool_call':
        if (event.data?.toolUseId && event.data?.toolName) {
          addToolCall(event.data.toolUseId, event.data.toolName, event.data.toolInput || {});
        }
        break;

      case 'tool_result':
        if (event.data?.toolUseId) {
          setToolResult(
            event.data.toolUseId,
            event.data.status || 'success',
            event.data.result
          );
          // Handle embedded canvas update from tool result
          if (event.data.canvasComponent) {
            const comp = event.data.canvasComponent;
            addAvailableComponent({ name: comp.componentName, filepath: '' });
            addToCanvas(comp);
            incrementComponentVersion(comp.componentName);
            setCurrentComponentName(comp.componentName);
          }
          // Handle embedded todos update from tool result
          if (event.data.todos) {
            setAgentTodos(event.data.todos);
          }
        }
        break;

      case 'todo_update':
        if (event.data?.todos) {
          setAgentTodos(event.data.todos);
        }
        break;

      case 'canvas_update':
        if (event.data?.canvasComponent) {
          const comp = event.data.canvasComponent;
          addAvailableComponent({ name: comp.componentName, filepath: '' });
          addToCanvas(comp);
          incrementComponentVersion(comp.componentName);
          setCurrentComponentName(comp.componentName);
        }
        break;

      case 'complete': {
        const block = useGenerationStore.getState().currentBlock;
        const content = block?.text || (event.data?.content as string) || '';
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

      case 'success':
        completeAssistantMessage();
        setTimeout(() => {
          setStreamPanelExpanded(false);
          if (!isCreateMode) {
            setGenerationMode('create');
            setEditingComponentName(null);
          }
        }, 2000);
        break;
    }
  }, [
    startNewBlock,
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
