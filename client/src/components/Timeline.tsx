import { useEffect, useRef } from 'react';
import { TimelineEvent } from './TimelineEvent';
import type { StreamEvent } from '../types';

interface TimelineProps {
  events: StreamEvent[];
}

export function Timeline({ events }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="max-h-[200px] overflow-y-auto space-y-1 scrollbar-thin"
    >
      {events.map((event, index) => (
        <TimelineEvent key={`${event.timestamp}-${index}`} event={event} />
      ))}
    </div>
  );
}
