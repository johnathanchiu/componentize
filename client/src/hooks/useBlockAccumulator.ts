import { useCallback, useRef } from 'react';
import { useConversationStore } from '../store/conversationStore';
import { useUIStore } from '../store/uiStore';
import { useProjectStore } from '../store/projectStore';
import { useCanvasStore } from '../store/canvasStore';
import type { StreamEvent } from '../types/index';

/**
 * Hook for processing stream events from the server.
 * Uses block-indexed accumulator pattern for clean event handling.
 *
 * Event types handled:
 * - thinking_delta: Accumulate thinking text
 * - text_delta: Accumulate response text
 * - tool_result: Handle tool results (with embedded canvas/todo updates)
 * - complete: Mark generation complete
 * - error: Handle errors
 */
export function useBlockAccumulator() {
  // Use refs to get latest store actions without causing re-renders
  const conversationStoreRef = useRef(useConversationStore.getState);
  const uiStoreRef = useRef(useUIStore.getState);
  const projectStoreRef = useRef(useProjectStore.getState);
  const canvasStoreRef = useRef(useCanvasStore.getState);

  /**
   * Process a single stream event
   */
  const processEvent = useCallback((event: StreamEvent, isResume: boolean = false) => {
    const convStore = conversationStoreRef.current();
    const uiStore = uiStoreRef.current();
    const projStore = projectStoreRef.current();
    const canvasStore = canvasStoreRef.current();

    switch (event.type) {
      case 'user_message':
        // On resume, rebuild user message from buffer
        if (isResume && event.data?.content) {
          convStore.addUserMessage(event.data.content as string);
        }
        break;

      case 'turn_start':
        convStore.startNewBlock();
        uiStore.setStreamStatus('thinking');
        // On resume, start new assistant message if needed
        if (isResume) {
          const messages = useConversationStore.getState().conversationMessages;
          const lastMsg = messages[messages.length - 1];
          if (!lastMsg || lastMsg.type !== 'assistant' || !lastMsg.isStreaming) {
            convStore.startAssistantMessage();
          }
        }
        break;

      case 'thinking_delta':
        if (event.data?.content) {
          convStore.appendThinkingDelta(event.data.content as string);
          const currentThinking = useConversationStore.getState().currentBlock?.thinking || '';
          convStore.updateCurrentAssistantThinking(currentThinking);
        }
        break;

      case 'text_delta':
        if (event.data?.content) {
          convStore.appendTextDelta(event.data.content as string);
        }
        break;

      case 'tool_call':
        if (event.data?.toolUseId && event.data?.toolName) {
          convStore.addToolCall(
            event.data.toolUseId,
            event.data.toolName,
            event.data.toolInput || {}
          );
          uiStore.setStreamStatus('acting');
        }
        break;

      case 'tool_result':
        if (event.data?.toolUseId) {
          convStore.setToolResult(
            event.data.toolUseId,
            event.data.status || 'success',
            event.data.result
          );

          // Handle embedded canvas update
          if (event.data.canvasComponent) {
            const comp = event.data.canvasComponent;
            projStore.addAvailableComponent({ name: comp.componentName, filepath: '' });
            canvasStore.addToCanvas(comp);
            uiStore.incrementComponentVersion(comp.componentName);
            uiStore.setCurrentComponentName(comp.componentName);
          }

          // Handle embedded todo update
          if (event.data.todos) {
            convStore.setAgentTodos(event.data.todos);
          }
        }
        break;

      // Handle legacy canvas_update for backward compatibility
      case 'canvas_update':
        if (event.data?.canvasComponent) {
          const comp = event.data.canvasComponent;
          projStore.addAvailableComponent({ name: comp.componentName, filepath: '' });
          canvasStore.addToCanvas(comp);
          uiStore.incrementComponentVersion(comp.componentName);
          uiStore.setCurrentComponentName(comp.componentName);
        }
        break;

      // Handle legacy todo_update for backward compatibility
      case 'todo_update':
        if (event.data?.todos) {
          convStore.setAgentTodos(event.data.todos);
        }
        break;

      case 'complete': {
        const block = useConversationStore.getState().currentBlock;
        const content = block?.text || (event.data?.content as string) || '';
        convStore.completeBlock();
        convStore.completeAssistantMessage(content);
        uiStore.setStreamStatus(event.data?.status === 'error' ? 'error' : 'success');
        // Note: NOT clearing todos here - they persist until agent clears them
        // Cleanup UI after delay
        setTimeout(() => {
          uiStore.setStreamPanelExpanded(false);
          uiStore.setGenerationMode('create');
          uiStore.setEditingComponentName(null);
        }, 3000);
        break;
      }

      case 'error':
        convStore.completeBlock();
        convStore.completeAssistantMessage();
        uiStore.setStreamStatus('error');
        break;

      // Legacy success event
      case 'success':
        convStore.completeAssistantMessage();
        uiStore.setStreamStatus('success');
        setTimeout(() => {
          uiStore.setStreamPanelExpanded(false);
          uiStore.setGenerationMode('create');
          uiStore.setEditingComponentName(null);
        }, 3000);
        break;
    }
  }, []);

  /**
   * Handle a full stream - iterates through all events
   */
  const handleStream = useCallback(async (
    stream: AsyncGenerator<StreamEvent>,
    options?: {
      userPrompt?: string;
      isResume?: boolean;
    }
  ) => {
    const { userPrompt, isResume = false } = options || {};
    const convStore = conversationStoreRef.current();

    // For fresh generation (not resume), add user message and start assistant
    if (!isResume && userPrompt) {
      convStore.addUserMessage(userPrompt);
      convStore.startAssistantMessage();
    }

    for await (const event of stream) {
      processEvent(event, isResume);
    }
  }, [processEvent]);

  /**
   * Resume an in-progress stream after page refresh
   */
  const resumeStream = useCallback(async (projectId: string) => {
    const { subscribeToStream } = await import('../lib/api');
    const convStore = useConversationStore.getState();
    const uiStore = useUIStore.getState();

    // Clear existing state - we'll rebuild from stream replay (since=0)
    convStore.clearConversation();

    uiStore.setIsGenerating(true);
    uiStore.setStreamPanelExpanded(true);
    uiStore.setStreamStatus('thinking');
    uiStore.setCurrentComponentName('components');

    try {
      // Subscribe from event 0 to replay all buffered events
      const stream = subscribeToStream(projectId, 0);
      await handleStream(stream, { isResume: true });
    } catch (err) {
      console.error('Failed to resume stream:', err);
      uiStore.setStreamStatus('error');
    } finally {
      uiStore.setIsGenerating(false);
    }
  }, [handleStream]);

  return {
    processEvent,
    handleStream,
    resumeStream,
  };
}
