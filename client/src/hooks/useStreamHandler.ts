import { useCallback, useRef } from 'react';
import { useGenerationStore } from '../store/generationStore';
import { useProjectStore } from '../store/projectStore';
import { useCanvasStore } from '../store/canvasStore';
import type { StreamEvent } from '../types/index';

/**
 * Hook for handling stream events from the server.
 * Used both for initial generation and for resuming streams on page refresh.
 */
export function useStreamHandler() {
  // Use refs to get latest store actions without causing re-renders
  const generationStoreRef = useRef(useGenerationStore.getState);
  const projectStoreRef = useRef(useProjectStore.getState);
  const canvasStoreRef = useRef(useCanvasStore.getState);

  /**
   * Process a single stream event. Call this for each event from the stream.
   */
  const processEvent = useCallback((event: StreamEvent, isResume: boolean = false) => {
    const genStore = generationStoreRef.current();
    const projStore = projectStoreRef.current();
    const canvasStore = canvasStoreRef.current();

    // Add to streaming events for timeline rendering
    genStore.addStreamingEvent(event);

    switch (event.type) {
      case 'user_message':
        // On resume, we may get user_message from the buffer
        if (isResume && event.data?.content) {
          genStore.addUserMessage(event.data.content);
        }
        break;

      case 'turn_start':
        genStore.startNewBlock();
        // Only start new assistant message if resuming AND there isn't one already streaming
        if (isResume) {
          const messages = useGenerationStore.getState().conversationMessages;
          const lastMsg = messages[messages.length - 1];
          // Only add assistant message if last message isn't an unfinished assistant message
          if (!lastMsg || lastMsg.type !== 'assistant' || !lastMsg.isStreaming) {
            genStore.startAssistantMessage();
          }
        }
        break;

      case 'thinking_delta':
        if (event.data?.content) {
          genStore.appendThinkingDelta(event.data.content);
          const currentThinking = useGenerationStore.getState().currentBlock?.thinking || '';
          genStore.updateCurrentAssistantThinking(currentThinking);
        }
        break;

      case 'text_delta':
        if (event.data?.content) {
          genStore.appendTextDelta(event.data.content);
        }
        break;

      case 'tool_call':
        if (event.data?.toolUseId && event.data?.toolName) {
          genStore.addToolCall(event.data.toolUseId, event.data.toolName, event.data.toolInput || {});
        }
        break;

      case 'tool_result':
        if (event.data?.toolUseId) {
          genStore.setToolResult(
            event.data.toolUseId,
            event.data.status || 'success',
            event.data.result
          );
        }
        break;

      case 'todo_update':
        if (event.data?.todos) {
          genStore.setAgentTodos(event.data.todos);
        }
        break;

      case 'canvas_update':
        if (event.data?.canvasComponent) {
          const comp = event.data.canvasComponent;
          projStore.addAvailableComponent({ name: comp.componentName, filepath: '' });
          canvasStore.addToCanvas(comp);
          genStore.incrementComponentVersion(comp.componentName);
          genStore.setCurrentComponentName(comp.componentName);
        }
        break;

      case 'complete': {
        const block = useGenerationStore.getState().currentBlock;
        const content = block?.text || (event.data?.content as string) || '';
        genStore.completeBlock();
        genStore.completeAssistantMessage(content);
        genStore.setAgentTodos([]);
        // Cleanup after success
        setTimeout(() => {
          setTimeout(() => {
            useGenerationStore.getState().setStreamPanelExpanded(false);
            useGenerationStore.getState().setGenerationMode('create');
            useGenerationStore.getState().setEditingComponentName(null);
          }, 2000);
        }, 1000);
        break;
      }

      case 'error':
        genStore.completeBlock();
        genStore.completeAssistantMessage();
        genStore.setStreamStatus('error');
        break;

      case 'success':
        genStore.completeAssistantMessage();
        genStore.setAgentTodos([]);
        setTimeout(() => {
          setTimeout(() => {
            useGenerationStore.getState().setStreamPanelExpanded(false);
            useGenerationStore.getState().setGenerationMode('create');
            useGenerationStore.getState().setEditingComponentName(null);
          }, 2000);
        }, 1000);
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
   */
  const resumeStream = useCallback(async (projectId: string) => {
    const { subscribeToStream } = await import('../lib/api');
    const genStore = useGenerationStore.getState();

    // Clear existing state - we'll rebuild from stream replay (since=0)
    genStore.clearConversation();
    genStore.clearStreamingEvents();

    genStore.setIsGenerating(true);
    genStore.setStreamPanelExpanded(true);
    genStore.setStreamStatus('thinking');
    genStore.setCurrentComponentName('components');

    try {
      // Subscribe from event 0 to replay all buffered events
      const stream = subscribeToStream(projectId, 0);
      await handleStream(stream, { isResume: true });
    } catch (err) {
      console.error('Failed to resume stream:', err);
      useGenerationStore.getState().setStreamStatus('error');
    } finally {
      useGenerationStore.getState().setIsGenerating(false);
    }
  }, [handleStream]);

  return {
    processEvent,
    handleStream,
    resumeStream,
  };
}
