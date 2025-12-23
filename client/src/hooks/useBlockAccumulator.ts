import { useCallback, useRef } from 'react';
import { useGenerationStore } from '../features/generation/generationStore';
import { useProjectStore } from '../store/projectStore';
import { useCanvasStore } from '../features/canvas/canvasStore';
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
  const generationStoreRef = useRef(useGenerationStore.getState);
  const projectStoreRef = useRef(useProjectStore.getState);
  const canvasStoreRef = useRef(useCanvasStore.getState);

  /**
   * Process a single stream event
   */
  const processEvent = useCallback((event: StreamEvent, isResume: boolean = false) => {
    const genStore = generationStoreRef.current();
    const projStore = projectStoreRef.current();
    const canvasStore = canvasStoreRef.current();

    switch (event.type) {
      case 'user_message':
        // On resume, rebuild user message from buffer
        if (isResume && event.data?.content) {
          genStore.addUserMessage(event.data.content as string);
        }
        break;

      case 'turn_start':
        genStore.startNewBlock();
        genStore.setStreamStatus('thinking');
        // On resume, start new assistant message if needed
        if (isResume) {
          const messages = useGenerationStore.getState().conversationMessages;
          const lastMsg = messages[messages.length - 1];
          if (!lastMsg || lastMsg.type !== 'assistant' || !lastMsg.isStreaming) {
            genStore.startAssistantMessage();
          }
        }
        break;

      case 'thinking_delta':
        if (event.data?.content) {
          genStore.appendThinkingDelta(event.data.content as string);
          const currentThinking = useGenerationStore.getState().currentBlock?.thinking || '';
          genStore.updateCurrentAssistantThinking(currentThinking);
        }
        break;

      case 'text_delta':
        if (event.data?.content) {
          genStore.appendTextDelta(event.data.content as string);
        }
        break;

      case 'tool_call':
        if (event.data?.toolUseId && event.data?.toolName) {
          genStore.addToolCall(
            event.data.toolUseId,
            event.data.toolName,
            event.data.toolInput || {}
          );
          genStore.setStreamStatus('acting');
        }
        break;

      case 'tool_result':
        if (event.data?.toolUseId) {
          genStore.setToolResult(
            event.data.toolUseId,
            event.data.status || 'success',
            event.data.result
          );

          // Handle embedded canvas update
          if (event.data.canvasComponent) {
            const comp = event.data.canvasComponent;
            projStore.addAvailableComponent({ name: comp.componentName, filepath: '' });
            canvasStore.add(comp);
            genStore.incrementComponentVersion(comp.componentName);
            genStore.setCurrentComponentName(comp.componentName);
          }

          // Handle embedded todo update
          if (event.data.todos) {
            genStore.setAgentTodos(event.data.todos);
          }
        }
        break;

      // Handle legacy canvas_update for backward compatibility
      case 'canvas_update':
        if (event.data?.canvasComponent) {
          const comp = event.data.canvasComponent;
          projStore.addAvailableComponent({ name: comp.componentName, filepath: '' });
          canvasStore.add(comp);
          genStore.incrementComponentVersion(comp.componentName);
          genStore.setCurrentComponentName(comp.componentName);
        }
        break;

      // Handle legacy todo_update for backward compatibility
      case 'todo_update':
        if (event.data?.todos) {
          genStore.setAgentTodos(event.data.todos);
        }
        break;

      case 'complete': {
        const block = useGenerationStore.getState().currentBlock;
        const content = block?.text || (event.data?.content as string) || '';
        genStore.completeBlock();
        genStore.completeAssistantMessage(content);
        genStore.setStreamStatus(event.data?.status === 'error' ? 'error' : 'success');
        // Note: NOT clearing todos here - they persist until agent clears them
        // Cleanup UI after delay
        setTimeout(() => {
          genStore.setStreamPanelExpanded(false);
          genStore.setGenerationMode('create');
          genStore.setEditingComponentName(null);
        }, 3000);
        break;
      }

      case 'error':
        genStore.completeBlock();
        genStore.completeAssistantMessage();
        genStore.setStreamStatus('error');
        break;

      // Legacy success event
      case 'success':
        genStore.completeAssistantMessage();
        genStore.setStreamStatus('success');
        setTimeout(() => {
          genStore.setStreamPanelExpanded(false);
          genStore.setGenerationMode('create');
          genStore.setEditingComponentName(null);
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
    const genStore = generationStoreRef.current();

    // For fresh generation (not resume), add user message and start assistant
    if (!isResume && userPrompt) {
      genStore.addUserMessage(userPrompt);
      genStore.startAssistantMessage();
    }

    for await (const event of stream) {
      processEvent(event, isResume);
    }
  }, [processEvent]);

  /**
   * Resume an in-progress stream after page refresh
   *
   * NOTE: Disk history is already loaded before this is called.
   * Buffer contains ONLY the current in-progress turn (mutually exclusive with disk).
   * We append buffer events on top of disk history.
   */
  const resumeStream = useCallback(async (projectId: string) => {
    const { subscribeToStream } = await import('../lib/api');
    const genStore = useGenerationStore.getState();

    // DON'T clear conversation - disk history is already loaded
    // Just start streaming to append in-progress events

    genStore.setIsGenerating(true);
    genStore.setStreamPanelExpanded(true);
    genStore.setStreamStatus('thinking');
    genStore.setCurrentComponentName('components');

    try {
      // Subscribe from event 0 to replay all buffered events
      const stream = subscribeToStream(projectId, 0);
      await handleStream(stream, { isResume: true });
    } catch (err) {
      // Buffer gone (404) or other error - that's fine, disk history is already loaded
      console.log('Buffer expired or error, using disk history:', err);
      genStore.setStreamStatus('idle');
    } finally {
      genStore.setIsGenerating(false);
    }
  }, [handleStream]);

  return {
    processEvent,
    handleStream,
    resumeStream,
  };
}
