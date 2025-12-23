import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getWorkspacePath } from './workspace';

export interface PageStyle {
  width: number | 'desktop' | 'tablet' | 'mobile';
  background?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pageStyle?: PageStyle;
}

export interface CanvasComponent {
  id: string;
  componentName: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

// Stream event for real-time streaming
export interface StreamEvent {
  type: string;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

// Accumulated conversation message (like minecraftlm format)
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  // Assistant-specific fields
  thinking?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    args?: Record<string, unknown>;
    status?: 'pending' | 'success' | 'error';
    result?: unknown;
  }>;
  // Tool result fields
  toolCallId?: string;
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
   * Update a project's metadata (partial update)
   */
  async updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<Project | null> {
    const project = await this.getProject(id);
    if (!project) return null;

    const updated: Project = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(this.getProjectMetadataPath(id), JSON.stringify(updated, null, 2));
    return updated;
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
   * Get the conversation history for a project (accumulated messages format)
   */
  async getHistory(projectId: string): Promise<ConversationMessage[]> {
    try {
      const historyPath = this.getHistoryPath(projectId);
      const content = await fs.readFile(historyPath, 'utf-8');
      return JSON.parse(content) as ConversationMessage[];
    } catch {
      return [];
    }
  }

  /**
   * Convert raw stream events into accumulated conversation messages
   * This creates the proper minecraftlm-style format for history persistence
   */
  convertEventsToMessages(events: StreamEvent[]): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    let currentAssistant: ConversationMessage | null = null;
    let accumulatedThinking = '';
    const toolCalls: Map<string, NonNullable<ConversationMessage['toolCalls']>[number]> = new Map();

    for (const event of events) {
      switch (event.type) {
        case 'user_message':
          // Save any pending assistant message first
          if (currentAssistant) {
            currentAssistant.thinking = accumulatedThinking || undefined;
            currentAssistant.toolCalls = Array.from(toolCalls.values());
            if (currentAssistant.thinking || currentAssistant.toolCalls.length > 0 || currentAssistant.content) {
              messages.push(currentAssistant);
            }
          }
          // Add user message
          messages.push({
            role: 'user',
            content: event.data?.prompt as string || event.message,
            timestamp: event.timestamp,
          });
          // Reset for next assistant turn
          currentAssistant = null;
          accumulatedThinking = '';
          toolCalls.clear();
          break;

        case 'turn_start':
          // Start new assistant message if needed
          if (!currentAssistant) {
            currentAssistant = {
              role: 'assistant',
              content: '',
              timestamp: event.timestamp,
            };
          } else if (accumulatedThinking) {
            // Add separator for new turn's thinking (after tool results)
            accumulatedThinking += '\n\n';
          }
          break;

        case 'thinking_delta':
          // Accumulate thinking text
          accumulatedThinking += event.data?.content || event.message || '';
          break;

        case 'tool_call':
          // Record tool call
          if (event.data?.toolUseId) {
            toolCalls.set(event.data.toolUseId as string, {
              id: event.data.toolUseId as string,
              name: event.data.toolName as string,
              status: 'pending',
            });
          }
          break;

        case 'tool_result':
          // Update tool call with result
          if (event.data?.toolUseId) {
            const tc = toolCalls.get(event.data.toolUseId as string);
            if (tc) {
              tc.status = event.data.status as 'success' | 'error';
              tc.result = event.data.result;
            }
          }
          break;

        case 'complete':
        case 'success':
          // Finalize assistant message
          if (currentAssistant) {
            const hasToolCalls = toolCalls.size > 0;
            // If there were no tool calls, the accumulated "thinking" is actually the content
            // (Claude's text response). Only treat it as thinking if tools were used.
            if (hasToolCalls) {
              currentAssistant.content = (event.data?.content as string) || '';
              currentAssistant.thinking = accumulatedThinking || undefined;
            } else {
              // No tools - the "thinking" deltas are actually the response content
              currentAssistant.content = accumulatedThinking || (event.data?.content as string) || '';
              currentAssistant.thinking = undefined;
            }
            currentAssistant.toolCalls = Array.from(toolCalls.values());
            messages.push(currentAssistant);
            currentAssistant = null;
            accumulatedThinking = '';
            toolCalls.clear();
          }
          break;

        case 'error':
          // Finalize with error
          if (currentAssistant) {
            currentAssistant.content = `Error: ${event.message}`;
            currentAssistant.thinking = accumulatedThinking || undefined;
            currentAssistant.toolCalls = Array.from(toolCalls.values());
            messages.push(currentAssistant);
            currentAssistant = null;
            accumulatedThinking = '';
            toolCalls.clear();
          }
          break;
      }
    }

    // Handle any remaining assistant message
    if (currentAssistant) {
      currentAssistant.thinking = accumulatedThinking || undefined;
      currentAssistant.toolCalls = Array.from(toolCalls.values());
      if (currentAssistant.thinking || currentAssistant.toolCalls.length > 0 || currentAssistant.content) {
        messages.push(currentAssistant);
      }
    }

    return messages;
  }

  /**
   * Append raw stream events to history (converts to messages first)
   */
  async appendHistory(projectId: string, events: StreamEvent[]): Promise<void> {
    const historyPath = this.getHistoryPath(projectId);
    const existing = await this.getHistory(projectId);
    const newMessages = this.convertEventsToMessages(events);
    const updated = [...existing, ...newMessages];
    await fs.writeFile(historyPath, JSON.stringify(updated, null, 2));
  }

  /**
   * Append a single conversation message to history
   */
  async appendHistoryMessage(projectId: string, message: ConversationMessage): Promise<void> {
    const historyPath = this.getHistoryPath(projectId);
    const existing = await this.getHistory(projectId);
    existing.push(message);
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
