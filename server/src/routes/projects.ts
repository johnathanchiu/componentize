import type { FastifyInstance } from 'fastify';
import { projectService } from '../services/projectService';
import { fileService } from '../services/fileService';

export function registerProjectRoutes(server: FastifyInstance) {
  // List all projects
  server.get('/api/projects', async () => {
    const projects = await projectService.listProjects();
    return { projects };
  });

  // Create a project
  server.post<{ Body: { name: string } }>('/api/projects', async (request, reply) => {
    const { name } = request.body;

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'Project name is required' });
    }

    try {
      const project = await projectService.createProject(name.trim());
      return { project };
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to create project',
      });
    }
  });

  // Get a project with all data
  server.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const { id } = request.params;
    const project = await projectService.getProject(id);

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    const [componentsResult, canvas] = await Promise.all([
      fileService.listProjectComponents(id),
      projectService.getCanvas(id),
    ]);

    return {
      project,
      components: componentsResult.components || [],
      canvas: canvas || [],
    };
  });

  // Delete a project
  server.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      await projectService.deleteProject(id);
      return { success: true };
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to delete project',
      });
    }
  });
}
