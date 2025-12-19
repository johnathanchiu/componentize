import type { FastifyInstance } from 'fastify';
import { componentAgent } from '../agents';

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

      try {
        for await (const event of componentAgent.generate(prompt)) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (error) {
        reply.raw.write(
          `data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
          })}\n\n`
        );
      } finally {
        componentAgent.clearProjectContext();
      }

      reply.raw.end();
    }
  );
}
