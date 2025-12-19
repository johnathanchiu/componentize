import type { FastifyInstance } from 'fastify';
import { componentAgent } from '../agents';
import { projectService, type StreamEvent } from '../services/projectService';

export function registerGenerationRoutes(server: FastifyInstance) {
  // Stream component generation
  server.post<{ Params: { id: string }; Body: { prompt: string } }>(
    '/api/projects/:id/generate',
    async (request, reply) => {
      const { id } = request.params;
      const { prompt } = request.body;

      if (!prompt?.trim()) {
        return reply.code(400).send({ error: 'Prompt is required' });
      }

      // Set project context
      componentAgent.setProjectContext(id);

      // SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': request.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true',
      });

      // Collect events for history persistence
      const sessionEvents: StreamEvent[] = [];

      // Add session start event
      const sessionStartEvent: StreamEvent = {
        type: 'session_start',
        message: 'Generating components',
        timestamp: Date.now(),
        data: { mode: 'create' },
      };
      sessionEvents.push(sessionStartEvent);

      // Add user message event
      const userMessageEvent: StreamEvent = {
        type: 'user_message',
        message: prompt,
        timestamp: Date.now(),
        data: { prompt },
      };
      sessionEvents.push(userMessageEvent);

      try {
        for await (const event of componentAgent.generate(prompt)) {
          // Store event for history
          sessionEvents.push(event as StreamEvent);
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (error) {
        const errorEvent: StreamEvent = {
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        };
        sessionEvents.push(errorEvent);
        reply.raw.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
      } finally {
        componentAgent.clearProjectContext();
        // Persist all events to history
        await projectService.appendHistory(id, sessionEvents);
      }

      reply.raw.end();
    }
  );
}
