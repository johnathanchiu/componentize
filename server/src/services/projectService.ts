import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { viteDevServerService } from './viteDevServerService';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

class ProjectService {
  /**
   * Get the path to the projects directory inside the workspace
   */
  private getProjectsDir(): string {
    return path.join(viteDevServerService.getWorkspacePath(), 'src', '.projects');
  }

  /**
   * Get the path to a specific project directory
   */
  getProjectDir(projectId: string): string {
    return path.join(this.getProjectsDir(), projectId);
  }

  /**
   * Get the path to a project's metadata file
   */
  private getProjectMetadataPath(projectId: string): string {
    return path.join(this.getProjectDir(projectId), 'project.json');
  }

  /**
   * Create a new project
   * Just creates a folder and metadata file - instant operation
   */
  async createProject(name: string): Promise<Project> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const project: Project = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
    };

    const projectDir = this.getProjectDir(id);

    // Create project directory
    await fs.mkdir(projectDir, { recursive: true });

    // Write metadata
    await fs.writeFile(
      this.getProjectMetadataPath(id),
      JSON.stringify(project, null, 2)
    );

    return project;
  }

  /**
   * Get a project by ID
   */
  async getProject(id: string): Promise<Project | null> {
    try {
      const metadataPath = this.getProjectMetadataPath(id);
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content) as Project;
    } catch {
      return null;
    }
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<Project[]> {
    const projectsDir = this.getProjectsDir();

    try {
      const entries = await fs.readdir(projectsDir, { withFileTypes: true });
      const projects: Project[] = [];

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== '.gitkeep') {
          const project = await this.getProject(entry.name);
          if (project) {
            projects.push(project);
          }
        }
      }

      // Sort by creation date, newest first
      return projects.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  /**
   * Delete a project and all its components
   */
  async deleteProject(id: string): Promise<void> {
    const projectDir = this.getProjectDir(id);

    try {
      await fs.rm(projectDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Failed to delete project ${id}:`, err);
      throw err;
    }
  }

  /**
   * Update a project's metadata
   */
  async updateProject(id: string, updates: Partial<Pick<Project, 'name'>>): Promise<Project | null> {
    const project = await this.getProject(id);
    if (!project) {
      return null;
    }

    const updatedProject: Project = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      this.getProjectMetadataPath(id),
      JSON.stringify(updatedProject, null, 2)
    );

    return updatedProject;
  }
}

export const projectService = new ProjectService();
