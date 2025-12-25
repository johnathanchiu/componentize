import { useCallback, useRef } from 'react';
import { useGenerationStore } from '@/store/generationStore';
import { useProjectStore } from '@/store/projectStore';
import { useCanvasStore } from '@/store/canvasStore';
import type { StreamEvent } from '@/shared/types';

/**
 * Hook for processing stream events from the server.
 * Uses block-indexed accumulator pattern for clean event handling.
 *
 * Event types (discriminated union):
 * - thinking: Accumulate thinking text
 * - text: Accumulate response text
 * - tool_call: Add tool call to block
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
      case 'thinking':
        genStore.appendThinkingDelta(event.content);
        // Set status to thinking on first thinking event during resume
        if (isResume) {
          genStore.setStreamStatus('thinking');
        }
        break;

      case 'text':
        genStore.appendTextDelta(event.content);
        break;

      case 'tool_call':
        genStore.addToolCall(event.id, event.name, event.input || {});
        genStore.setStreamStatus('acting');
        break;

      case 'tool_result':
        genStore.setToolResult(event.id, event.success ? 'success' : 'error', event.output);

        // Handle embedded canvas update
        if (event.canvas) {
          projStore.addAvailableComponent({ name: event.canvas.componentName, filepath: '' });
          canvasStore.add(event.canvas);
          genStore.incrementComponentVersion(event.canvas.componentName);
          genStore.setCurrentComponentName(event.canvas.componentName);
        }

        // Handle embedded todo update
        if (event.todos) {
          genStore.setAgentTodos(event.todos);
        }
        break;

      case 'complete': {
        genStore.completeAssistantMessage();
        genStore.setStreamStatus('success');
        // Cleanup UI after delay
        setTimeout(() => {
          genStore.setStreamPanelExpanded(false);
          genStore.setGenerationMode('create');
          genStore.setEditingComponentName(null);
        }, 3000);
        break;
      }

      case 'error':
        genStore.completeAssistantMessage();
        genStore.setStreamStatus('error');
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
    const { subscribeToStream } = await import('@/lib/api');
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
