import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { appConfig } from './config';
import { componentAgent } from './agents/componentAgent';
import { interactionAgent} from './agents/interactionAgent';
import { fileService } from './services/fileService';
import { exportService } from './services/exportService';
import { previewService } from './services/previewService';
import type {
  GenerateComponentRequest,
  EditComponentRequest,
  GenerateInteractionRequest,
  ExportPageRequest
} from '../../shared/types';

// Create Fastify instance with logging
const server = Fastify({
  logger: {
    level: appConfig.isDevelopment ? 'info' : 'warn',
    transport: appConfig.isDevelopment ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// Register CORS
server.register(cors, {
  origin: appConfig.cors.allowedOrigins,
  credentials: true,
});

// Register rate limiting
server.register(rateLimit, {
  max: appConfig.rateLimit.max,
  timeWindow: appConfig.rateLimit.windowMs,
});

// Health check
server.get('/api/health', async () => {
  return {
    status: 'ok',
    message: 'Component Builder API is running',
    version: '2.0.0',
    environment: appConfig.env,
  };
});

// ============================================================================
// Component Endpoints (Streaming)
// ============================================================================

/**
 * Generate a new component with streaming progress
 */
server.post<{ Body: GenerateComponentRequest }>('/api/generate-component-stream', async (request, reply) => {
  const { prompt, componentName } = request.body;

  if (!prompt || !componentName) {
    return reply.code(400).send({
      status: 'error',
      message: 'Both prompt and componentName are required',
    });
  }

  // Set headers for Server-Sent Events
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    for await (const event of componentAgent.generateComponent(prompt, componentName)) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error) {
    reply.raw.write(`data: ${JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
  }

  reply.raw.end();
});

/**
 * Edit an existing component with streaming progress
 */
server.post<{ Body: EditComponentRequest }>('/api/edit-component-stream', async (request, reply) => {
  const { componentName, editDescription } = request.body;

  if (!componentName || !editDescription) {
    return reply.code(400).send({
      status: 'error',
      message: 'Both componentName and editDescription are required',
    });
  }

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    for await (const event of componentAgent.editComponent(componentName, editDescription)) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error) {
    reply.raw.write(`data: ${JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
  }

  reply.raw.end();
});

/**
 * Get component code
 */
server.get<{ Params: { componentName: string } }>('/api/get-component-code/:componentName', async (request) => {
  const { componentName } = request.params;
  return await fileService.readComponent(componentName);
});

/**
 * List all components
 */
server.get('/api/list-components', async () => {
  return await fileService.listComponents();
});

// ============================================================================
// Interaction Endpoints (Streaming)
// ============================================================================

/**
 * Generate interaction with streaming progress
 */
server.post<{ Body: GenerateInteractionRequest }>('/api/generate-interaction-stream', async (request, reply) => {
  const { componentId, componentName, description, eventType } = request.body;

  if (!componentId || !componentName || !description) {
    return reply.code(400).send({
      status: 'error',
      message: 'componentId, componentName, and description are required',
    });
  }

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    for await (const event of interactionAgent.generateInteraction(
      componentId,
      componentName,
      description,
      eventType || 'onClick'
    )) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error) {
    reply.raw.write(`data: ${JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
  }

  reply.raw.end();
});

// ============================================================================
// Export Endpoint
// ============================================================================

/**
 * Export page with all components as ZIP
 */
server.post<{ Body: ExportPageRequest }>('/api/export-page', async (request, reply) => {
  const { pageName, layout } = request.body;

  if (!pageName || !layout) {
    return reply.code(400).send({
      status: 'error',
      message: 'Both pageName and layout are required',
    });
  }

  try {
    const zipStream = await exportService.exportPageAsZip(pageName, layout);

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${pageName}.zip"`);

    return reply.send(zipStream);
  } catch (error) {
    return reply.code(500).send({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to export page',
    });
  }
});

// ============================================================================
// Preview Endpoint
// ============================================================================

/**
 * Serve component preview HTML
 */
server.get<{ Params: { componentName: string } }>('/preview/:componentName', async (request, reply) => {
  const { componentName } = request.params;

  const html = await previewService.generatePreviewHTML(componentName);

  if (!html) {
    return reply.code(404).send(`<html><body><p>Component '${componentName}' not found</p></body></html>`);
  }

  reply.header('Content-Type', 'text/html');
  return reply.send(html);
});

// ============================================================================
// Start Server
// ============================================================================

const start = async () => {
  try {
    await server.listen({ port: appConfig.port, host: '0.0.0.0' });

    console.log('');
    console.log('🚀 Component Builder API v2.0 (TypeScript)');
    console.log(`📍 Server running on http://localhost:${appConfig.port}`);
    console.log(`🌍 Environment: ${appConfig.env}`);
    console.log(`🤖 AI Model: ${appConfig.api.modelName}`);
    console.log('💡 Make sure to set ANTHROPIC_API_KEY in .env file');
    console.log('');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
