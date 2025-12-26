import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getWorkspacePath } from './workspace';
import type { StreamEvent, PageStyle, Section, Layer, LayoutState } from '../../../shared/types';

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
  section?: string; // Section this component belongs to
}

// Default page style
const DEFAULT_PAGE_STYLE: PageStyle = {
  width: 1200,
  background: '#ffffff',
};

// Default layout state
const DEFAULT_LAYOUT_STATE: LayoutState = {
  pageStyle: DEFAULT_PAGE_STYLE,
  sections: [],
  layers: [],
};

// Predefined section order for proper page layout (top to bottom)
const SECTION_ORDER = [
  'nav', 'navbar', 'header',
  'hero',
  'features', 'benefits',
  'stats', 'metrics',
  'testimonials', 'reviews',
  'pricing',
  'cta', 'call-to-action',
  'faq',
  'contact',
  'footer'
];

// Accumulated conversation message (like minecraftlm format)
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  // Assistant-specific fields
  thinking?: string;
  thinkingSignature?: string; // Required by Anthropic API for multi-turn
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
   * Get the path to a project's layout state file
   */
  private getLayoutPath(projectId: string): string {
    return path.join(this.getProjectDir(projectId), 'layout.json');
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
   * Get the layout state for a project
   */
  async getLayout(projectId: string): Promise<LayoutState> {
    try {
      const layoutPath = this.getLayoutPath(projectId);
      const content = await fs.readFile(layoutPath, 'utf-8');
      return JSON.parse(content) as LayoutState;
    } catch {
      return { ...DEFAULT_LAYOUT_STATE };
    }
  }

  /**
   * Save the layout state for a project
   */
  async saveLayout(projectId: string, layout: LayoutState): Promise<void> {
    const layoutPath = this.getLayoutPath(projectId);
    await fs.writeFile(layoutPath, JSON.stringify(layout, null, 2));
  }

  /**
   * Update page style
   */
  async updatePageStyle(projectId: string, pageStyle: Partial<PageStyle>): Promise<LayoutState> {
    const layout = await this.getLayout(projectId);
    layout.pageStyle = { ...layout.pageStyle, ...pageStyle };
    await this.saveLayout(projectId, layout);
    return layout;
  }

  /**
   * Add or update a section
   */
  async upsertSection(projectId: string, section: Section): Promise<LayoutState> {
    const layout = await this.getLayout(projectId);
    const existingIndex = layout.sections.findIndex(s => s.name === section.name);
    if (existingIndex >= 0) {
      layout.sections[existingIndex] = section;
    } else {
      layout.sections.push(section);
    }
    await this.saveLayout(projectId, layout);
    return layout;
  }

  /**
   * Add component to a section
   */
  async addComponentToSection(
    projectId: string,
    sectionName: string,
    componentName: string,
    size: { width: number; height: number },
    gap?: number,
    sectionLayout: 'row' | 'column' = 'column'
  ): Promise<{ layout: LayoutState; position: { x: number; y: number } }> {
    const layout = await this.getLayout(projectId);

    // Find or create section
    let section = layout.sections.find(s => s.name === sectionName);
    if (!section) {
      section = { name: sectionName, layout: sectionLayout, components: [] };

      // Insert section at correct position based on SECTION_ORDER
      const newSectionOrder = this.getSectionOrderIndex(sectionName);
      const insertIndex = layout.sections.findIndex(s => {
        const existingOrder = this.getSectionOrderIndex(s.name);
        return existingOrder > newSectionOrder;
      });

      if (insertIndex === -1) {
        // No section with higher order found, add at end
        layout.sections.push(section);
      } else {
        // Insert before the first section with higher order
        layout.sections.splice(insertIndex, 0, section);
      }
    }

    // Check if component already exists in this section
    const existingIndex = section.components.findIndex(c => c.name === componentName);
    if (existingIndex >= 0) {
      // Update existing component
      section.components[existingIndex] = { name: componentName, size, gap };
    } else {
      // Add new component
      section.components.push({ name: componentName, size, gap });
    }

    await this.saveLayout(projectId, layout);

    // Calculate position
    const position = this.calculateComponentPosition(layout, sectionName, componentName);

    return { layout, position };
  }

  /**
   * Add or update a layer
   */
  async upsertLayer(projectId: string, layer: Layer): Promise<LayoutState> {
    const layout = await this.getLayout(projectId);
    const existingIndex = layout.layers.findIndex(l => l.name === layer.name);
    if (existingIndex >= 0) {
      layout.layers[existingIndex] = layer;
    } else {
      layout.layers.push(layer);
    }
    await this.saveLayout(projectId, layout);
    return layout;
  }

  /**
   * Recalculate positions for all components in a section.
   * This ensures row layouts stay properly centered as components are added.
   * Must be called after adding/removing components from a section.
   */
  async recalculateSectionPositions(projectId: string, sectionName: string): Promise<CanvasComponent[]> {
    const layout = await this.getLayout(projectId);
    const canvas = await this.getCanvas(projectId);
    const section = layout.sections.find(s => s.name === sectionName);

    if (!section) return [];

    const updated: CanvasComponent[] = [];
    for (const comp of section.components) {
      const position = this.calculateComponentPosition(layout, sectionName, comp.name);
      const canvasComp = canvas.find(c => c.componentName === comp.name);
      if (canvasComp) {
        canvasComp.position = position;
        updated.push(canvasComp);
      }
    }

    await this.saveCanvas(projectId, canvas);
    return updated;
  }

  /**
   * Calculate component position based on section layout
   */
  calculateComponentPosition(
    layout: LayoutState,
    sectionName: string,
    componentName: string
  ): { x: number; y: number } {
    const pageWidth = layout.pageStyle.width;
    const SECTION_GAP = 40;
    const COMPONENT_GAP = 20;

    let currentY = 0;

    for (const section of layout.sections) {
      const sectionHeight = this.calculateSectionHeight(section);

      if (section.name === sectionName) {
        // Found the section, now find the component
        if (section.layout === 'column') {
          // Column layout: components stack vertically, each centered
          // Gap is applied BEFORE each component (except first)
          let componentY = currentY;
          for (let i = 0; i < section.components.length; i++) {
            const comp = section.components[i];
            // Add gap before this component (except first)
            if (i > 0) {
              componentY += comp.gap ?? COMPONENT_GAP;
            }
            if (comp.name === componentName) {
              const x = (pageWidth - comp.size.width) / 2;
              return { x, y: componentY };
            }
            componentY += comp.size.height;
          }
        } else {
          // Row layout: components side by side, entire row centered
          // Gap is applied BEFORE each component (except first)
          const totalWidth = section.components.reduce((sum, c, i) => {
            return sum + c.size.width + (i > 0 ? (c.gap ?? COMPONENT_GAP) : 0);
          }, 0);
          const rowHeight = Math.max(...section.components.map(c => c.size.height));

          let componentX = (pageWidth - totalWidth) / 2;
          for (let i = 0; i < section.components.length; i++) {
            const comp = section.components[i];
            // Add gap before this component (except first)
            if (i > 0) {
              componentX += comp.gap ?? COMPONENT_GAP;
            }
            if (comp.name === componentName) {
              // Center component vertically within row
              const y = currentY + (rowHeight - comp.size.height) / 2;
              return { x: componentX, y };
            }
            componentX += comp.size.width;
          }
        }
      }

      currentY += sectionHeight + (section.gap ?? SECTION_GAP);
    }

    // Component not found, return default position
    return { x: 0, y: currentY };
  }

  /**
   * Get the order index for a section name.
   * Lower index = appears earlier in page (top).
   * Unknown sections get a high index to appear at the end.
   */
  private getSectionOrderIndex(sectionName: string): number {
    const lowerName = sectionName.toLowerCase();
    const index = SECTION_ORDER.findIndex(s => lowerName.includes(s) || s.includes(lowerName));
    return index >= 0 ? index : 999; // Unknown sections go at the end
  }

  /**
   * Calculate section height
   */
  private calculateSectionHeight(section: Section): number {
    const COMPONENT_GAP = 20;

    if (section.layout === 'column') {
      return section.components.reduce((sum, c, i) => {
        return sum + c.size.height + (i > 0 ? (c.gap ?? COMPONENT_GAP) : 0);
      }, 0);
    } else {
      // Row layout: height is the tallest component
      return Math.max(...section.components.map(c => c.size.height), 0);
    }
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
   * Convert stream events into accumulated conversation messages
   */
  convertEventsToMessages(events: StreamEvent[]): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    let currentAssistant: ConversationMessage | null = null;
    let accumulatedThinking = '';
    let accumulatedText = '';
    let thinkingSignature = '';
    const toolCalls: Map<string, NonNullable<ConversationMessage['toolCalls']>[number]> = new Map();

    for (const event of events) {
      switch (event.type) {
        case 'thinking_signature':
          if (!currentAssistant) {
            currentAssistant = { role: 'assistant', content: '', timestamp: Date.now() };
          }
          thinkingSignature = event.signature;
          break;

        case 'thinking':
          if (!currentAssistant) {
            currentAssistant = { role: 'assistant', content: '', timestamp: Date.now() };
          }
          accumulatedThinking += event.content;
          break;

        case 'text':
          if (!currentAssistant) {
            currentAssistant = { role: 'assistant', content: '', timestamp: Date.now() };
          }
          accumulatedText += event.content;
          break;

        case 'tool_call':
          if (!currentAssistant) {
            currentAssistant = { role: 'assistant', content: '', timestamp: Date.now() };
          }
          toolCalls.set(event.id, {
            id: event.id,
            name: event.name,
            args: event.input as Record<string, unknown>,
            status: 'pending',
          });
          break;

        case 'tool_result':
          const tc = toolCalls.get(event.id);
          if (tc) {
            tc.status = event.success ? 'success' : 'error';
            tc.result = event.output;
          }
          break;

        case 'complete':
          if (currentAssistant) {
            currentAssistant.thinking = accumulatedThinking || undefined;
            currentAssistant.thinkingSignature = thinkingSignature || undefined;
            currentAssistant.content = accumulatedText || event.content || '';
            currentAssistant.toolCalls = Array.from(toolCalls.values());
            messages.push(currentAssistant);
            currentAssistant = null;
            accumulatedThinking = '';
            accumulatedText = '';
            thinkingSignature = '';
            toolCalls.clear();
          }
          break;

        case 'error':
          if (currentAssistant) {
            currentAssistant.thinking = accumulatedThinking || undefined;
            currentAssistant.thinkingSignature = thinkingSignature || undefined;
            currentAssistant.content = `Error: ${event.message}`;
            currentAssistant.toolCalls = Array.from(toolCalls.values());
            messages.push(currentAssistant);
            currentAssistant = null;
            accumulatedThinking = '';
            accumulatedText = '';
            thinkingSignature = '';
            toolCalls.clear();
          }
          break;
      }
    }

    // Handle any remaining assistant message
    if (currentAssistant) {
      currentAssistant.thinking = accumulatedThinking || undefined;
      currentAssistant.thinkingSignature = thinkingSignature || undefined;
      currentAssistant.content = accumulatedText;
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
