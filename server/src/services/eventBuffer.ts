/**
 * Event Buffer Service
 *
 * Push-based event buffer using EventEmitter pattern.
 * No polling - subscribers receive events as they arrive.
 */

import { EventEmitter } from 'events';

interface ProjectEventBuffer {
  events: string[];        // Pre-serialized SSE strings
  isComplete: boolean;
  isStarted: boolean;
  error: string | null;
  createdAt: number;
}

// Global buffer store
const buffers = new Map<string, ProjectEventBuffer>();

// Event emitter for push-based subscriptions
const emitter = new EventEmitter();
emitter.setMaxListeners(100); // Allow many concurrent subscribers

// TTL for buffers (30 minutes)
const BUFFER_TTL_MS = 30 * 60 * 1000;

/**
 * Clean up expired buffers periodically
 */
function cleanupExpiredBuffers(): void {
  const now = Date.now();
  for (const [projectId, buffer] of buffers.entries()) {
    if (now - buffer.createdAt > BUFFER_TTL_MS) {
      buffers.delete(projectId);
      emitter.removeAllListeners(`event:${projectId}`);
      emitter.removeAllListeners(`complete:${projectId}`);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredBuffers, 5 * 60 * 1000);

/**
 * Create a fresh buffer for a project
 */
export function createBuffer(projectId: string): ProjectEventBuffer {
  const buffer: ProjectEventBuffer = {
    events: [],
    isComplete: false,
    isStarted: false,
    error: null,
    createdAt: Date.now(),
  };
  buffers.set(projectId, buffer);
  return buffer;
}

/**
 * Get existing buffer for a project
 */
export function getBuffer(projectId: string): ProjectEventBuffer | undefined {
  return buffers.get(projectId);
}

/**
 * Check if a task is currently running for a project
 */
export function isTaskRunning(projectId: string): boolean {
  const buffer = buffers.get(projectId);
  return buffer !== undefined && buffer.isStarted && !buffer.isComplete;
}

/**
 * Append a pre-serialized SSE event to the buffer
 * Pushes to all subscribers immediately
 */
export function appendEvent(projectId: string, sseString: string): void {
  const buffer = buffers.get(projectId);
  if (buffer) {
    buffer.events.push(sseString);
    // Push to subscribers
    emitter.emit(`event:${projectId}`, sseString);
  }
}

/**
 * Mark buffer as started
 */
export function markStarted(projectId: string): void {
  const buffer = buffers.get(projectId);
  if (buffer) {
    buffer.isStarted = true;
  }
}

/**
 * Mark buffer as complete (optionally with error)
 */
export function markComplete(projectId: string, error?: string): void {
  const buffer = buffers.get(projectId);
  if (buffer) {
    buffer.isComplete = true;
    buffer.error = error || null;
    // Notify subscribers that stream is complete
    emitter.emit(`complete:${projectId}`);
  }
}

/**
 * Clear buffer for a project (after flushing to disk)
 */
export function clearBuffer(projectId: string): void {
  buffers.delete(projectId);
  emitter.removeAllListeners(`event:${projectId}`);
  emitter.removeAllListeners(`complete:${projectId}`);
}

/**
 * Get buffer status for a project
 */
export function getBufferStatus(projectId: string): {
  status: 'idle' | 'running' | 'complete' | 'error';
  eventCount: number;
  error: string | null;
} {
  const buffer = buffers.get(projectId);

  if (!buffer) {
    return { status: 'idle', eventCount: 0, error: null };
  }

  if (buffer.error) {
    return { status: 'error', eventCount: buffer.events.length, error: buffer.error };
  }

  if (buffer.isComplete) {
    return { status: 'complete', eventCount: buffer.events.length, error: null };
  }

  if (buffer.isStarted) {
    return { status: 'running', eventCount: buffer.events.length, error: null };
  }

  return { status: 'idle', eventCount: buffer.events.length, error: null };
}

/**
 * Async generator for SSE streaming with replay support
 * Push-based - no polling, events arrive immediately via EventEmitter
 *
 * @param projectId - The project to subscribe to
 * @param since - Skip first N events (for resumption)
 */
export async function* subscribe(
  projectId: string,
  since: number = 0
): AsyncGenerator<string> {
  const buffer = buffers.get(projectId);
  if (!buffer) return;

  // Replay existing events first
  for (let i = since; i < buffer.events.length; i++) {
    yield buffer.events[i];
  }

  // If already complete, we're done
  if (buffer.isComplete) {
    return;
  }

  // Track where we are in the buffer
  let lastYielded = buffer.events.length;

  // Create promise-based event listener
  const eventQueue: string[] = [];
  let resolveWait: (() => void) | null = null;
  let isComplete = false;

  const onEvent = (sseString: string) => {
    eventQueue.push(sseString);
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  };

  const onComplete = () => {
    isComplete = true;
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  };

  emitter.on(`event:${projectId}`, onEvent);
  emitter.on(`complete:${projectId}`, onComplete);

  try {
    // Yield any events that arrived between replay and listener setup
    while (lastYielded < buffer.events.length) {
      yield buffer.events[lastYielded];
      lastYielded++;
    }

    // Listen for new events
    while (!isComplete) {
      // Drain the queue
      while (eventQueue.length > 0) {
        const event = eventQueue.shift()!;
        yield event;
      }

      // If complete, exit
      if (isComplete || buffer.isComplete) {
        break;
      }

      // Wait for next event
      await new Promise<void>(resolve => {
        resolveWait = resolve;
      });
    }

    // Drain any remaining events
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }
  } finally {
    // Clean up listeners
    emitter.off(`event:${projectId}`, onEvent);
    emitter.off(`complete:${projectId}`, onComplete);
  }
}

/**
 * Helper to create an SSE-formatted string from a StreamEvent
 */
export function makeSSE(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Get all events from buffer as parsed objects (for saving to disk)
 */
export function getBufferEvents(projectId: string): unknown[] {
  const buffer = buffers.get(projectId);
  if (!buffer) return [];

  return buffer.events.map(sseString => {
    // Parse "data: {...}\n\n" format
    const jsonStr = sseString.slice(6, -2);
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }).filter(Boolean);
}
