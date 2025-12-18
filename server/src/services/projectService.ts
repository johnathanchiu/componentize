import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getWorkspacePath } from './workspace';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasComponent {
  id: string;
  componentName: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  interactions?: any[];
}

export interface CanvasLayout {
  id: string;
  layoutName: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface CanvasState {
  components: CanvasComponent[];
  layouts: CanvasLayout[];
}

class ProjectService {
  /**
   * Get the path to the projects directory inside the workspace
   */
  private getProjectsDir(): string {
    return path.join(getWorkspacePath(), 'projects');
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
    } catch (error) {
      // Log error instead of silently returning empty
      // TODO: Consider returning a response wrapper with error status
      console.error('Failed to list projects:', error);
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
   * Get the path to a project's canvas file
   */
  private getCanvasPath(projectId: string): string {
    return path.join(this.getProjectDir(projectId), 'canvas.json');
  }

  /**
   * Get the canvas state for a project
   */
  async getCanvas(projectId: string): Promise<CanvasComponent[]> {
    try {
      const canvasPath = this.getCanvasPath(projectId);
      const content = await fs.readFile(canvasPath, 'utf-8');
      return JSON.parse(content) as CanvasComponent[];
    } catch {
      return [];
    }
  }

  /**
   * Save the canvas state for a project
   */
  async saveCanvas(projectId: string, components: CanvasComponent[]): Promise<void> {
    const canvasPath = this.getCanvasPath(projectId);
    await fs.writeFile(canvasPath, JSON.stringify(components, null, 2));
  }

  /**
   * Get the canvas state with layouts for a project
   * Handles migration from old format (array) to new format (object with components and layouts)
   */
  async getCanvasWithLayouts(projectId: string): Promise<CanvasState> {
    try {
      const canvasPath = this.getCanvasPath(projectId);
      const content = await fs.readFile(canvasPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Handle old format (array of components) vs new format (object with components and layouts)
      if (Array.isArray(parsed)) {
        return { components: parsed, layouts: [] };
      }

      return {
        components: parsed.components || [],
        layouts: parsed.layouts || []
      };
    } catch {
      return { components: [], layouts: [] };
    }
  }

  /**
   * Save the canvas state with layouts for a project
   */
  async saveCanvasWithLayouts(projectId: string, state: CanvasState): Promise<void> {
    const canvasPath = this.getCanvasPath(projectId);
    await fs.writeFile(canvasPath, JSON.stringify(state, null, 2));
  }

  /**
   * List all component names in a project
   * Components are stored as {name}.tsx files in the project directory
   */
  async listComponents(projectId: string): Promise<string[]> {
    const projectDir = this.getProjectDir(projectId);

    try {
      const entries = await fs.readdir(projectDir);
      return entries
        .filter(f => f.endsWith('.tsx'))
        .map(f => f.replace('.tsx', ''));
    } catch {
      return [];
    }
  }
}

export const projectService = new ProjectService();
