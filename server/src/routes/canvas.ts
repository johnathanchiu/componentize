import type { FastifyInstance } from 'fastify';
import { projectService } from '../services/projectService';

interface CanvasComponent {
  id: string;
  componentName: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

export function registerCanvasRoutes(server: FastifyInstance) {
  // Save canvas state
  server.put<{ Params: { id: string }; Body: { components: CanvasComponent[] } }>(
    '/api/projects/:id/canvas',
    async (request, reply) => {
      const { id } = request.params;
      const { components } = request.body;

      if (!Array.isArray(components)) {
        return reply.code(400).send({ error: 'components must be an array' });
      }

      try {
        await projectService.saveCanvas(id, components);
        return { success: true };
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to save canvas',
        });
      }
    }
  );
}
