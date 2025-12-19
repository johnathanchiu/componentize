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
}

// Stream event for conversation history
export interface StreamEvent {
  type: string;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
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
   * Get the path to a project's canvas file
   */
  private getCanvasPath(projectId: string): string {
    return path.join(this.getProjectDir(projectId), 'canvas.json');
  }

  /**
   * Get the path to a project's conversation history file
   */
  private getHistoryPath(projectId: string): string {
    return path.join(this.getProjectDir(projectId), 'history.json');
  }

  /**
   * Create a new project
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
    await fs.writeFile(this.getProjectMetadataPath(id), JSON.stringify(project, null, 2));

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
    } catch (error) {
      console.warn(`Failed to load project ${id}:`, error);
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
      return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Failed to list projects:', error);
      return [];
    }
  }

  /**
   * Delete a project and all its components
   */
  async deleteProject(id: string): Promise<void> {
    const projectDir = this.getProjectDir(id);
    await fs.rm(projectDir, { recursive: true, force: true });
  }

  /**
   * Get the canvas state for a project
   */
  async getCanvas(projectId: string): Promise<CanvasComponent[]> {
    try {
      const canvasPath = this.getCanvasPath(projectId);
      const content = await fs.readFile(canvasPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Handle both old format (array) and new format (object with components)
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return parsed.components || [];
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
   * List all component names in a project
   */
  async listComponents(projectId: string): Promise<string[]> {
    const projectDir = this.getProjectDir(projectId);

    try {
      const entries = await fs.readdir(projectDir);
      return entries.filter((f) => f.endsWith('.tsx')).map((f) => f.replace('.tsx', ''));
    } catch {
      return [];
    }
  }

  /**
   * Get the conversation history for a project
   */
  async getHistory(projectId: string): Promise<StreamEvent[]> {
    try {
      const historyPath = this.getHistoryPath(projectId);
      const content = await fs.readFile(historyPath, 'utf-8');
      return JSON.parse(content) as StreamEvent[];
    } catch {
      return [];
    }
  }

  /**
   * Append events to the conversation history
   */
  async appendHistory(projectId: string, events: StreamEvent[]): Promise<void> {
    const historyPath = this.getHistoryPath(projectId);
    const existing = await this.getHistory(projectId);
    const updated = [...existing, ...events];
    await fs.writeFile(historyPath, JSON.stringify(updated, null, 2));
  }

  /**
   * Append a single event to the conversation history
   */
  async appendHistoryEvent(projectId: string, event: StreamEvent): Promise<void> {
    const historyPath = this.getHistoryPath(projectId);
    const existing = await this.getHistory(projectId);
    existing.push(event);
    await fs.writeFile(historyPath, JSON.stringify(existing, null, 2));
  }

  /**
   * Clear the conversation history for a project
   */
  async clearHistory(projectId: string): Promise<void> {
    const historyPath = this.getHistoryPath(projectId);
    await fs.writeFile(historyPath, JSON.stringify([], null, 2));
  }
}

export const projectService = new ProjectService();
