import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { appConfig } from './config';
import { componentAgent } from './agents/componentAgent';
import { interactionAgent} from './agents/interactionAgent';
import { fileService } from './services/fileService';
import { exportService } from './services/exportService';
import { previewService } from './services/previewService';
import { projectService } from './services/projectService';
import { viteDevServerService } from './services/viteDevServerService';
import type {
  GenerateInteractionRequest,
  ExportPageRequest
} from '../../shared/types';

// Simple request type for unified generation
interface GenerateRequest {
  prompt: string;
}

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

  // Set headers for Server-Sent Events (including CORS)
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': request.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
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
  const { pageName, layout, projectId } = request.body;

  if (!pageName || !layout || !projectId) {
    return reply.code(400).send({
      status: 'error',
      message: 'pageName, layout, and projectId are required',
    });
  }

  try {
    const zipStream = await exportService.exportPageAsZip(pageName, layout, projectId);

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
// Project Endpoints
// ============================================================================

/**
 * Create a new project
 */
server.post<{ Body: { name: string } }>('/api/projects', async (request, reply) => {
  const { name } = request.body;

  if (!name || name.trim().length === 0) {
    return reply.code(400).send({
      status: 'error',
      message: 'Project name is required',
    });
  }

  try {
    const project = await projectService.createProject(name.trim());
    return { status: 'success', project };
  } catch (error) {
    return reply.code(500).send({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create project',
    });
  }
});

/**
 * List all projects
 */
server.get('/api/projects', async () => {
  const projects = await projectService.listProjects();
  return { status: 'success', projects };
});

/**
 * Get a specific project
 */
server.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
  const { id } = request.params;
  const project = await projectService.getProject(id);

  if (!project) {
    return reply.code(404).send({
      status: 'error',
      message: 'Project not found',
    });
  }

  return { status: 'success', project };
});

/**
 * Delete a project
 */
server.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
  const { id } = request.params;

  try {
    await projectService.deleteProject(id);
    return { status: 'success', message: 'Project deleted' };
  } catch (error) {
    return reply.code(500).send({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to delete project',
    });
  }
});

/**
 * List components in a project
 */
server.get<{ Params: { id: string } }>('/api/projects/:id/components', async (request) => {
  const { id } = request.params;
  return await fileService.listProjectComponents(id);
});

/**
 * Get component code in a project
 */
server.get<{ Params: { id: string; componentName: string } }>('/api/projects/:id/components/:componentName/code', async (request) => {
  const { id, componentName } = request.params;
  return await fileService.readProjectComponent(id, componentName);
});

/**
 * Get raw component source (plain text for direct rendering)
 */
server.get<{ Params: { id: string; componentName: string } }>('/api/projects/:id/components/:componentName', async (request, reply) => {
  const { id, componentName } = request.params;
  const result = await fileService.readProjectComponent(id, componentName);

  if (result.status === 'success' && result.content) {
    reply.type('text/plain').send(result.content);
  } else {
    reply.code(404).send('Component not found');
  }
});

/**
 * Delete a component from a project
 */
server.delete<{ Params: { id: string; componentName: string } }>('/api/projects/:id/components/:componentName', async (request, reply) => {
  const { id, componentName } = request.params;

  try {
    const result = await fileService.deleteProjectComponent(id, componentName);
    return result;
  } catch (error) {
    return reply.code(500).send({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to delete component',
    });
  }
});

/**
 * Unified generation endpoint - handles both single components and full pages
 * The agent decides whether to plan (for complex requests) or create directly (for simple requests)
 */
server.post<{
  Params: { id: string };
  Body: GenerateRequest;
}>('/api/projects/:id/generate-stream', async (request, reply) => {
  const { id } = request.params;
  const { prompt } = request.body;

  if (!prompt) {
    return reply.code(400).send({
      status: 'error',
      message: 'Prompt is required',
    });
  }

  // Set project context on the agent
  componentAgent.setProjectContext(id);

  // Set headers for Server-Sent Events
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': request.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  try {
    for await (const event of componentAgent.generate(prompt)) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error) {
    reply.raw.write(`data: ${JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
  } finally {
    componentAgent.clearProjectContext();
  }

  reply.raw.end();
});

/**
 * Get Vite dev server info
 */
server.get('/api/vite-server', async () => {
  return {
    status: 'success',
    port: viteDevServerService.getPort(),
    ready: viteDevServerService.isServerReady(),
  };
});

// ============================================================================
// Canvas Endpoints
// ============================================================================

/**
 * Get canvas state for a project
 */
server.get<{ Params: { id: string } }>('/api/projects/:id/canvas', async (request) => {
  const { id } = request.params;
  const components = await projectService.getCanvas(id);
  return { status: 'success', components };
});

/**
 * Save canvas state for a project
 */
server.put<{ Params: { id: string }; Body: { components: any[] } }>('/api/projects/:id/canvas', async (request, reply) => {
  const { id } = request.params;
  const { components } = request.body;

  if (!Array.isArray(components)) {
    return reply.code(400).send({
      status: 'error',
      message: 'components must be an array',
    });
  }

  try {
    await projectService.saveCanvas(id, components);
    return { status: 'success' };
  } catch (error) {
    return reply.code(500).send({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to save canvas',
    });
  }
});

// ============================================================================
// Start Server
// ============================================================================

const start = async () => {
  try {
    // Start Vite dev server first
    console.log('Starting Vite dev server...');
    await viteDevServerService.start();

    // Then start the API server
    await server.listen({ port: appConfig.port, host: '0.0.0.0' });

    console.log('');
    console.log('🚀 Component Builder API v2.0 (TypeScript)');
    console.log(`📍 Server running on http://localhost:${appConfig.port}`);
    console.log(`🎨 Vite preview server on http://localhost:${viteDevServerService.getPort()}`);
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
