import type { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health';
import { registerProjectRoutes } from './projects';
import { registerComponentRoutes } from './components';
import { registerCanvasRoutes } from './canvas';
import { registerGenerationRoutes } from './generation';
import { registerExportRoutes } from './export';

export function registerRoutes(server: FastifyInstance) {
  registerHealthRoutes(server);
  registerProjectRoutes(server);
  registerComponentRoutes(server);
  registerCanvasRoutes(server);
  registerGenerationRoutes(server);
  registerExportRoutes(server);
}

export { registerHealthRoutes } from './health';
export { registerProjectRoutes } from './projects';
export { registerComponentRoutes } from './components';
export { registerCanvasRoutes } from './canvas';
export { registerGenerationRoutes } from './generation';
export { registerExportRoutes } from './export';
