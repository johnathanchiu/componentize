import type { FastifyInstance } from 'fastify';
import { exportService } from '../services/exportService';

interface PageLayout {
  components: Array<{
    componentName: string;
    position: { x: number; y: number };
    size?: { width: number; height: number };
  }>;
}

interface ExportRequest {
  projectId: string;
  pageName: string;
  layout: PageLayout;
}

export function registerExportRoutes(server: FastifyInstance) {
  // Export page as ZIP
  server.post<{ Body: ExportRequest }>('/api/export', async (request, reply) => {
    const { projectId, pageName, layout } = request.body;

    if (!projectId || !pageName || !layout) {
      return reply.code(400).send({
        error: 'projectId, pageName, and layout are required',
      });
    }

    try {
      const zipStream = await exportService.exportPageAsZip(pageName, layout, projectId);

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${pageName}.zip"`);

      return reply.send(zipStream);
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to export page',
      });
    }
  });
}
