import { useEffect, useRef, useMemo } from 'react';
import { Brain } from 'lucide-react';
import { TimelineEvent } from './TimelineEvent';
import { useGenerationStore, type AssistantBlock } from '../features/generation/generationStore';
import type { StreamEvent } from '../types';

interface TimelineProps {
  events: StreamEvent[];
}

// Render the current accumulated thinking block
function CurrentBlockDisplay({ block }: { block: AssistantBlock }) {
  if (!block.thinking && block.toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="flex items-start gap-2 px-3 py-2 border-l-2 border-l-ai-thinking bg-ai-thinking/5">
      <div className="mt-0.5 flex-shrink-0">
        <Brain className="w-3.5 h-3.5 text-ai-thinking" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-700 leading-relaxed break-words whitespace-pre-wrap">
          {block.thinking}
          {/* Blinking cursor while streaming */}
          <span className="inline-block w-1.5 h-4 bg-ai-thinking animate-pulse ml-0.5 align-text-bottom" />
        </p>
      </div>
    </div>
  );
}

export function Timeline({ events }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentBlock } = useGenerationStore();

  // Filter events to avoid duplicates and delta events:
  // - Skip thinking_delta events (accumulated in currentBlock)
  // - Skip turn_start events (not rendered)
  // - Skip code_delta if there's a code_complete (final result supersedes partial)
  // - Only keep one code_complete per component name
  const filteredEvents = useMemo(() => {
    const result: StreamEvent[] = [];
    const seenCodeComplete = new Set<string>(); // Track by componentName

    // First pass: identify which components have code_complete
    for (const event of events) {
      if (event.type === 'code_complete') {
        const compName = event.data?.componentName || '';
        seenCodeComplete.add(compName);
      }
    }

    // Check if any code_complete exists at all (if so, skip all code_delta)
    const hasAnyCodeComplete = seenCodeComplete.size > 0;

    // Second pass: filter events
    const processedCodeComplete = new Set<string>();

    for (const event of events) {
      // Skip delta events (they're accumulated in currentBlock)
      if (event.type === 'thinking_delta' || event.type === 'turn_start') {
        continue;
      }

      if (event.type === 'code_streaming' || event.type === 'code_delta') {
        // Skip code_delta if there's any code_complete (final result is more useful)
        // Only show code_delta if we're still actively streaming
        if (hasAnyCodeComplete) {
          continue;
        }
        // For active streaming, only keep the most recent code_delta
        // (handled by the TimelineEvent component showing latest state)
        result.push(event);
      } else if (event.type === 'code_complete') {
        // Only include one code_complete per component
        const compName = event.data?.componentName || '';
        if (!processedCodeComplete.has(compName)) {
          processedCodeComplete.add(compName);
          result.push(event);
        }
      } else {
        result.push(event);
      }
    }

    return result;
  }, [events]);

  // Auto-scroll to bottom when new events arrive or when currentBlock updates
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredEvents, currentBlock?.thinking]);

  if (filteredEvents.length === 0 && !currentBlock) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto space-y-1 scrollbar-thin"
    >
      {filteredEvents.map((event, index) => (
        <TimelineEvent key={`${event.timestamp}-${index}`} event={event} />
      ))}
      {/* Render the current accumulated thinking block at the end */}
      {currentBlock && <CurrentBlockDisplay block={currentBlock} />}
    </div>
  );
}
