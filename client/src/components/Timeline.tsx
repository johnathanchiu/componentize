import { useEffect, useRef, useMemo } from 'react';
import { TimelineEvent } from './TimelineEvent';
import type { StreamEvent } from '../types';

interface TimelineProps {
  events: StreamEvent[];
}

export function Timeline({ events }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter events to avoid duplicates:
  // - Only keep the most recent code_streaming event (previous ones are superseded)
  // - Only keep one code_complete per component name
  const filteredEvents = useMemo(() => {
    const result: StreamEvent[] = [];
    const seenCodeComplete = new Set<string>(); // Track by componentName
    let lastCodeStreamingIndex = -1;

    // Find the index of the last code_streaming event
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type === 'code_streaming') {
        lastCodeStreamingIndex = i;
        break;
      }
    }

    // Include all events except superseded/duplicate ones
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.type === 'code_streaming') {
        // Only include the most recent code_streaming event
        if (i === lastCodeStreamingIndex) {
          result.push(event);
        }
        // Skip older code_streaming events
      } else if (event.type === 'code_complete') {
        // Only include one code_complete per component
        const compName = event.data?.componentName || '';
        if (!seenCodeComplete.has(compName)) {
          seenCodeComplete.add(compName);
          result.push(event);
        }
      } else {
        result.push(event);
      }
    }

    return result;
  }, [events]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredEvents]);

  if (filteredEvents.length === 0) {
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
    </div>
  );
}
