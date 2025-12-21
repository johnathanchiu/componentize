/**
 * Event Buffer Service
 *
 * Buffers SSE events for each project, enabling:
 * - Event replay on page refresh
 * - Stream resumption with `since` parameter
 * - Proper event sequencing
 */

interface ProjectEventBuffer {
  events: string[];        // Pre-serialized SSE strings
  isComplete: boolean;
  isStarted: boolean;
  error: string | null;
  createdAt: number;
}

// Global buffer store - in production could use Redis with TTL
const buffers = new Map<string, ProjectEventBuffer>();

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
 */
export function appendEvent(projectId: string, sseString: string): void {
  const buffer = buffers.get(projectId);
  if (buffer) {
    buffer.events.push(sseString);
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
  }
}

/**
 * Clear buffer for a project (after flushing to disk)
 */
export function clearBuffer(projectId: string): void {
  buffers.delete(projectId);
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
 *
 * @param projectId - The project to subscribe to
 * @param since - Skip first N events (for resumption)
 * @param timeout - Max seconds to wait for new events (default 5 minutes)
 */
export async function* subscribe(
  projectId: string,
  since: number = 0,
  timeout: number = 300
): AsyncGenerator<string> {
  const buffer = buffers.get(projectId);
  if (!buffer) return;

  let lastIndex = since;
  let idleIterations = 0;
  const maxIdleIterations = timeout * 10; // 100ms poll interval
  let keepaliveCounter = 0;

  while (true) {
    // Yield any new events
    let hadEvents = false;
    while (lastIndex < buffer.events.length) {
      yield buffer.events[lastIndex];
      lastIndex++;
      keepaliveCounter = 0;
      idleIterations = 0;
      hadEvents = true;
    }

    // Check if complete
    if (buffer.isComplete) {
      return;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, 100));

    // Track idle time
    if (!hadEvents) {
      idleIterations++;
      if (idleIterations >= maxIdleIterations) {
        // Timeout - stop streaming
        return;
      }
    }

    // Send keepalive every ~30 seconds
    keepaliveCounter++;
    if (keepaliveCounter >= 300) {
      yield ': keepalive\n\n';
      keepaliveCounter = 0;
    }
  }
}

/**
 * Helper to create an SSE-formatted string from a StreamEvent
 * The event is serialized directly, not wrapped in another object
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
    const jsonStr = sseString.slice(6, -2); // Remove "data: " prefix and "\n\n" suffix
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }).filter(Boolean);
}
