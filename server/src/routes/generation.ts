import type { FastifyInstance } from 'fastify';
import { designAgent } from '../agents';
import { projectService, type StreamEvent } from '../services/projectService';
import {
  createBuffer,
  getBuffer,
  appendEvent,
  markStarted,
  markComplete,
  subscribe,
  makeSSE,
  isTaskRunning,
  getBufferEvents,
} from '../services/eventBuffer';

export function registerGenerationRoutes(server: FastifyInstance) {
  // SSE stream endpoint with replay support
  // Use ?since=N to resume from event N (for page refresh reconnection)
  server.get<{ Params: { id: string }; Querystring: { since?: string } }>(
    '/api/projects/:id/stream',
    async (request, reply) => {
      const { id } = request.params;
      const since = parseInt(request.query.since || '0', 10);

      const buffer = getBuffer(id);
      if (!buffer) {
        return reply.code(404).send({ error: 'No active task for this project' });
      }

      // SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': request.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true',
      });

      // Stream events from buffer (with replay from since=N)
      for await (const sseString of subscribe(id, since)) {
        reply.raw.write(sseString);
      }

      reply.raw.end();
    }
  );

  // Start generation (POST) - returns immediately, streams via /stream endpoint
  server.post<{ Params: { id: string }; Body: { prompt: string } }>(
    '/api/projects/:id/generate',
    async (request, reply) => {
      const { id } = request.params;
      const { prompt } = request.body;

      if (!prompt?.trim()) {
        return reply.code(400).send({ error: 'Prompt is required' });
      }

      // Check if task is already running
      if (isTaskRunning(id)) {
        return reply.code(409).send({ error: 'Task already running for this project' });
      }

      // Create fresh buffer for this task
      const buffer = createBuffer(id);

      // Add initial events to buffer
      // Persist user message to disk immediately (complete event, not buffered)
      const timestamp = Date.now();
      await projectService.appendHistoryMessage(id, {
        role: 'user',
        content: prompt,
        timestamp,
      });

      // Add session_start to buffer (for stream subscribers)
      const sessionStartEvent: StreamEvent = {
        type: 'session_start',
        message: 'Generating components',
        timestamp,
        data: { mode: 'create' },
      };
      appendEvent(id, makeSSE(sessionStartEvent));

      // Mark buffer as started
      markStarted(id);

      // Start agent in background (non-blocking)
      setImmediate(async () => {
        try {
          // Set project context for file operations
          designAgent.setProjectContext(id);

          // Run agent and buffer all events
          for await (const event of designAgent.generate(prompt)) {
            appendEvent(id, makeSSE(event));
          }

          // Mark complete
          markComplete(id);

          // Persist assistant turn to history (user message already saved)
          const allEvents = getBufferEvents(id) as StreamEvent[];
          // Filter out user_message since it's already on disk
          const assistantEvents = allEvents.filter(e => e.type !== 'user_message');
          await projectService.appendHistory(id, assistantEvents);

        } catch (error) {
          const errorEvent: StreamEvent = {
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
          };
          appendEvent(id, makeSSE(errorEvent));
          markComplete(id, errorEvent.message);

          // Persist assistant turn even on error (user message already saved)
          const allEvents = getBufferEvents(id) as StreamEvent[];
          const assistantEvents = allEvents.filter(e => e.type !== 'user_message');
          await projectService.appendHistory(id, assistantEvents);
        } finally {
          designAgent.clearProjectContext();
        }
      });

      // Return immediately with stream URL
      return {
        status: 'started',
        projectId: id,
        streamUrl: `/api/projects/${id}/stream`,
      };
    }
  );

}
