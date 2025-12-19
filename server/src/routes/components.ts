import type { FastifyInstance } from 'fastify';
import { fileService } from '../services/fileService';

export function registerComponentRoutes(server: FastifyInstance) {
  // Get component source code (returns plain text)
  server.get<{ Params: { id: string; name: string } }>(
    '/api/projects/:id/components/:name',
    async (request, reply) => {
      const { id, name } = request.params;
      const result = await fileService.readProjectComponent(id, name);

      if (result.status === 'error' || !result.content) {
        return reply.code(404).send({ error: 'Component not found' });
      }

      reply.type('text/plain');
      return result.content;
    }
  );

  // Delete a component
  server.delete<{ Params: { id: string; name: string } }>(
    '/api/projects/:id/components/:name',
    async (request, reply) => {
      const { id, name } = request.params;

      try {
        await fileService.deleteProjectComponent(id, name);
        return { success: true };
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to delete component',
        });
      }
    }
  );
}
