import fs from 'fs/promises';
import path from 'path';
import type { Component, ComponentResponse, ListComponentsResponse, LayoutDefinition } from '../../../shared/types';
import { projectService } from './projectService';

// Layout-specific response types
export interface LayoutResponse {
  status: 'success' | 'error';
  message: string;
  layout_name?: string;
  layout?: LayoutDefinition;
}

export interface ListLayoutsResponse {
  status: 'success' | 'error';
  message: string;
  layouts?: string[];
}

export class FileService {
  /**
   * Validate component name (PascalCase, starts with uppercase)
   */
  private validateComponentName(name: string): { valid: boolean; error?: string } {
    if (!name || name.length === 0) {
      return { valid: false, error: 'Component name cannot be empty' };
    }

    if (name.length > 50) {
      return { valid: false, error: 'Component name too long (max 50 characters)' };
    }

    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      return { valid: false, error: 'Component name must be PascalCase (e.g., Button, PricingCard)' };
    }

    return { valid: true };
  }

  /**
   * Validate component code (must contain actual code, not explanations)
   */
  private validateComponentCode(code: string): { valid: boolean; error?: string } {
    const codeLower = code.toLowerCase();

    // Check for explanatory text instead of code
    const explanatoryPhrases = ['here is', 'i have created', 'i\'ve created', 'this component', '## '];
    if (explanatoryPhrases.some(phrase => codeLower.includes(phrase))) {
      return {
        valid: false,
        error: 'Code contains explanatory text. Please provide only TypeScript/React code.'
      };
    }

    // Check for minimum code patterns
    if (!codeLower.includes('function') && !codeLower.includes('const') && !code.includes('=>')) {
      return {
        valid: false,
        error: 'Code doesn\'t appear to contain a valid React component.'
      };
    }

    return { valid: true };
  }

  // ============================================
  // Component Methods (Project-scoped)
  // ============================================

  /**
   * Create a new component file in a project
   */
  async createProjectComponent(projectId: string, name: string, code: string): Promise<ComponentResponse> {
    const nameValidation = this.validateComponentName(name);
    if (!nameValidation.valid) {
      return { status: 'error', message: nameValidation.error! };
    }

    const codeValidation = this.validateComponentCode(code);
    if (!codeValidation.valid) {
      return { status: 'error', message: codeValidation.error! };
    }

    const basePath = projectService.getProjectDir(projectId);
    const filepath = path.join(basePath, `${name}.tsx`);

    try {
      await fs.access(filepath);
      return {
        status: 'error',
        message: `Component '${name}' already exists in this project. Use update instead.`
      };
    } catch {
      // File doesn't exist, proceed with creation
    }

    try {
      await fs.writeFile(filepath, code, 'utf-8');
      return {
        status: 'success',
        message: `Component '${name}' created successfully`,
        component_name: name,
        filepath,
        content: code
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to create component: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update an existing component file in a project
   */
  async updateProjectComponent(projectId: string, name: string, code: string): Promise<ComponentResponse> {
    const codeValidation = this.validateComponentCode(code);
    if (!codeValidation.valid) {
      return { status: 'error', message: codeValidation.error! };
    }

    const basePath = projectService.getProjectDir(projectId);
    const filepath = path.join(basePath, `${name}.tsx`);

    try {
      await fs.access(filepath);
    } catch {
      return {
        status: 'error',
        message: `Component '${name}' not found in this project. Use create instead.`
      };
    }

    try {
      await fs.writeFile(filepath, code, 'utf-8');
      return {
        status: 'success',
        message: `Component '${name}' updated successfully`,
        component_name: name,
        filepath,
        content: code
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to update component: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Read a component file from a project
   */
  async readProjectComponent(projectId: string, name: string): Promise<ComponentResponse> {
    const basePath = projectService.getProjectDir(projectId);
    const filepath = path.join(basePath, `${name}.tsx`);

    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return {
        status: 'success',
        message: `Component '${name}' read successfully`,
        component_name: name,
        filepath,
        content
      };
    } catch {
      return {
        status: 'error',
        message: `Component '${name}' not found in this project`
      };
    }
  }

  /**
   * List all components in a project
   */
  async listProjectComponents(projectId: string): Promise<ListComponentsResponse> {
    const basePath = projectService.getProjectDir(projectId);

    try {
      const files = await fs.readdir(basePath);
      const tsxFiles = files.filter(file => file.endsWith('.tsx'));

      const components: Component[] = tsxFiles.map(file => ({
        name: path.basename(file, '.tsx'),
        filepath: path.join(basePath, file)
      }));

      return {
        status: 'success',
        message: `Found ${components.length} component(s)`,
        components
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to list components: ${error instanceof Error ? error.message : 'Unknown error'}`,
        components: []
      };
    }
  }

  /**
   * Delete a component file from a project
   */
  async deleteProjectComponent(projectId: string, name: string): Promise<ComponentResponse> {
    const basePath = projectService.getProjectDir(projectId);
    const filepath = path.join(basePath, `${name}.tsx`);

    try {
      await fs.unlink(filepath);
      return {
        status: 'success',
        message: `Component '${name}' deleted successfully`,
        component_name: name
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to delete component '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if a component exists in a project
   */
  async componentExists(projectId: string, name: string): Promise<boolean> {
    const filepath = path.join(projectService.getProjectDir(projectId), `${name}.tsx`);
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // Layout Methods
  // ============================================

  /**
   * Get the layouts directory for a project
   */
  private getLayoutsPath(projectId: string): string {
    return path.join(projectService.getProjectDir(projectId), 'layouts');
  }

  /**
   * Ensure layouts directory exists
   */
  private async ensureLayoutsDir(projectId: string): Promise<void> {
    const layoutsPath = this.getLayoutsPath(projectId);
    await fs.mkdir(layoutsPath, { recursive: true });
  }

  /**
   * Validate layout name
   */
  private validateLayoutName(name: string): { valid: boolean; error?: string } {
    if (!name || name.length === 0) {
      return { valid: false, error: 'Layout name cannot be empty' };
    }
    if (name.length > 50) {
      return { valid: false, error: 'Layout name too long (max 50 characters)' };
    }
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      return { valid: false, error: 'Layout name must be PascalCase (e.g., PricingSection, HeroArea)' };
    }
    return { valid: true };
  }

  /**
   * Create a new layout
   */
  async createLayout(projectId: string, name: string, layout: LayoutDefinition): Promise<LayoutResponse> {
    const nameValidation = this.validateLayoutName(name);
    if (!nameValidation.valid) {
      return { status: 'error', message: nameValidation.error! };
    }

    await this.ensureLayoutsDir(projectId);
    const filepath = path.join(this.getLayoutsPath(projectId), `${name}.json`);

    // Check if layout already exists
    try {
      await fs.access(filepath);
      return { status: 'error', message: `Layout '${name}' already exists. Use update instead.` };
    } catch {
      // File doesn't exist, proceed
    }

    try {
      const layoutWithName = { ...layout, name };
      await fs.writeFile(filepath, JSON.stringify(layoutWithName, null, 2), 'utf-8');
      return {
        status: 'success',
        message: `Layout '${name}' created successfully`,
        layout_name: name,
        layout: layoutWithName
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to create layout: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Read a layout
   */
  async readLayout(projectId: string, name: string): Promise<LayoutResponse> {
    const filepath = path.join(this.getLayoutsPath(projectId), `${name}.json`);

    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const layout = JSON.parse(content) as LayoutDefinition;
      return {
        status: 'success',
        message: `Layout '${name}' read successfully`,
        layout_name: name,
        layout
      };
    } catch {
      return { status: 'error', message: `Layout '${name}' not found` };
    }
  }

  /**
   * Update a layout
   */
  async updateLayout(projectId: string, name: string, layout: LayoutDefinition): Promise<LayoutResponse> {
    const filepath = path.join(this.getLayoutsPath(projectId), `${name}.json`);

    // Check if layout exists
    try {
      await fs.access(filepath);
    } catch {
      return { status: 'error', message: `Layout '${name}' not found. Use create instead.` };
    }

    try {
      const layoutWithName = { ...layout, name };
      await fs.writeFile(filepath, JSON.stringify(layoutWithName, null, 2), 'utf-8');
      return {
        status: 'success',
        message: `Layout '${name}' updated successfully`,
        layout_name: name,
        layout: layoutWithName
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to update layout: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Delete a layout
   */
  async deleteLayout(projectId: string, name: string): Promise<LayoutResponse> {
    const filepath = path.join(this.getLayoutsPath(projectId), `${name}.json`);

    try {
      await fs.unlink(filepath);
      return {
        status: 'success',
        message: `Layout '${name}' deleted successfully`,
        layout_name: name
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to delete layout '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * List all layouts for a project (names only)
   */
  async listLayouts(projectId: string): Promise<ListLayoutsResponse> {
    const layoutsPath = this.getLayoutsPath(projectId);

    try {
      await this.ensureLayoutsDir(projectId);
      const files = await fs.readdir(layoutsPath);
      const layouts = files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));

      return {
        status: 'success',
        message: `Found ${layouts.length} layout(s)`,
        layouts
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to list layouts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        layouts: []
      };
    }
  }

  /**
   * List all layouts with full definitions for a project
   */
  async listAllLayouts(projectId: string): Promise<LayoutDefinition[]> {
    const layoutsPath = this.getLayoutsPath(projectId);

    try {
      await this.ensureLayoutsDir(projectId);
      const files = await fs.readdir(layoutsPath);
      const layouts: LayoutDefinition[] = [];

      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const content = await fs.readFile(path.join(layoutsPath, file), 'utf-8');
          layouts.push(JSON.parse(content));
        } catch {
          // Skip invalid layout files
        }
      }

      return layouts;
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const fileService = new FileService();
