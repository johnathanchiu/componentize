import type { FastifyInstance } from 'fastify';
import { appConfig } from '../config';

export function registerHealthRoutes(server: FastifyInstance) {
  server.get('/api/health', async () => {
    return {
      status: 'ok',
      version: '3.0.0',
      environment: appConfig.env,
    };
  });
}
