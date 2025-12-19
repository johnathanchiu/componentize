import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { appConfig } from './config';
import { registerRoutes } from './routes';

export async function createApp() {
  const server = Fastify({
    logger: {
      level: appConfig.isDevelopment ? 'info' : 'warn',
      transport: appConfig.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
  });

  // Register CORS
  await server.register(cors, {
    origin: appConfig.cors.allowedOrigins,
    credentials: true,
  });

  // Register rate limiting
  await server.register(rateLimit, {
    max: appConfig.rateLimit.max,
    timeWindow: appConfig.rateLimit.windowMs,
  });

  // Register all routes
  registerRoutes(server);

  return server;
}
