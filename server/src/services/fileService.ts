import fs from 'fs/promises';
import path from 'path';
import { appConfig } from '../config';
import type { Component, ComponentResponse, ListComponentsResponse } from '../../../shared/types';
import { projectService } from './projectService';

export class FileService {
  private componentsPath: string;
  private pagesPath: string;

  constructor() {
    this.componentsPath = path.join(process.cwd(), appConfig.paths.components);
    this.pagesPath = path.join(process.cwd(), appConfig.paths.pages);
    this.ensureDirectoriesExist();
  }

  private async ensureDirectoriesExist(): Promise<void> {
    await fs.mkdir(this.componentsPath, { recursive: true });
    await fs.mkdir(this.pagesPath, { recursive: true });
  }

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

  /**
   * Create a new component file
   */
  async createComponent(name: string, code: string): Promise<ComponentResponse> {
    // Validate name
    const nameValidation = this.validateComponentName(name);
    if (!nameValidation.valid) {
      return {
        status: 'error',
        message: nameValidation.error!
      };
    }

    // Validate code
    const codeValidation = this.validateComponentCode(code);
    if (!codeValidation.valid) {
      return {
        status: 'error',
        message: codeValidation.error!
      };
    }

    const filepath = path.join(this.componentsPath, `${name}.tsx`);

    // Check if component already exists
    try {
      await fs.access(filepath);
      return {
        status: 'error',
        message: `Component '${name}' already exists. Use update instead.`
      };
    } catch {
      // File doesn't exist, proceed with creation
    }

    // Write component file
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
   * Update an existing component file
   */
  async updateComponent(name: string, code: string): Promise<ComponentResponse> {
    // Validate code
    const codeValidation = this.validateComponentCode(code);
    if (!codeValidation.valid) {
      return {
        status: 'error',
        message: codeValidation.error!
      };
    }

    const filepath = path.join(this.componentsPath, `${name}.tsx`);

    // Check if component exists
    try {
      await fs.access(filepath);
    } catch {
      return {
        status: 'error',
        message: `Component '${name}' not found. Use create instead.`
      };
    }

    // Write updated component
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
   * Read a component file
   */
  async readComponent(name: string): Promise<ComponentResponse> {
    const filepath = path.join(this.componentsPath, `${name}.tsx`);

    try {
      const content = await fs.readFile(filepath, 'utf-8');

      return {
        status: 'success',
        message: `Component '${name}' read successfully`,
        component_name: name,
        filepath,
        content
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Component '${name}' not found`
      };
    }
  }

  /**
   * List all components
   */
  async listComponents(): Promise<ListComponentsResponse> {
    try {
      const files = await fs.readdir(this.componentsPath);
      const tsxFiles = files.filter(file => file.endsWith('.tsx'));

      const components: Component[] = tsxFiles.map(file => ({
        name: path.basename(file, '.tsx'),
        filepath: path.join(this.componentsPath, file)
      }));

      return {
        status: 'success',
        message: `Found ${components.length} component(s)`,
        components
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to list components: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Delete a component file
   */
  async deleteComponent(name: string): Promise<ComponentResponse> {
    const filepath = path.join(this.componentsPath, `${name}.tsx`);

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
   * Create a page file
   */
  async createPage(name: string, code: string): Promise<ComponentResponse> {
    const nameValidation = this.validateComponentName(name);
    if (!nameValidation.valid) {
      return {
        status: 'error',
        message: nameValidation.error!
      };
    }

    const filepath = path.join(this.pagesPath, `${name}.tsx`);

    try {
      await fs.writeFile(filepath, code, 'utf-8');

      return {
        status: 'success',
        message: `Page '${name}' created successfully`,
        component_name: name,
        filepath,
        content: code
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to create page: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // ============================================
  // Project-scoped component methods
  // ============================================

  /**
   * Create a component within a project
   */
  async createProjectComponent(projectId: string, name: string, code: string): Promise<ComponentResponse> {
    // Validate name
    const nameValidation = this.validateComponentName(name);
    if (!nameValidation.valid) {
      return {
        status: 'error',
        message: nameValidation.error!
      };
    }

    // Validate code
    const codeValidation = this.validateComponentCode(code);
    if (!codeValidation.valid) {
      return {
        status: 'error',
        message: codeValidation.error!
      };
    }

    const projectDir = projectService.getProjectDir(projectId);
    const filepath = path.join(projectDir, `${name}.tsx`);

    // Check if component already exists
    try {
      await fs.access(filepath);
      return {
        status: 'error',
        message: `Component '${name}' already exists in this project. Use update instead.`
      };
    } catch {
      // File doesn't exist, proceed with creation
    }

    // Write component file
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
   * Update a component within a project
   */
  async updateProjectComponent(projectId: string, name: string, code: string): Promise<ComponentResponse> {
    // Validate code
    const codeValidation = this.validateComponentCode(code);
    if (!codeValidation.valid) {
      return {
        status: 'error',
        message: codeValidation.error!
      };
    }

    const projectDir = projectService.getProjectDir(projectId);
    const filepath = path.join(projectDir, `${name}.tsx`);

    // Check if component exists
    try {
      await fs.access(filepath);
    } catch {
      return {
        status: 'error',
        message: `Component '${name}' not found in this project. Use create instead.`
      };
    }

    // Write updated component
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
   * Read a component from a project
   */
  async readProjectComponent(projectId: string, name: string): Promise<ComponentResponse> {
    const projectDir = projectService.getProjectDir(projectId);
    const filepath = path.join(projectDir, `${name}.tsx`);

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
    const projectDir = projectService.getProjectDir(projectId);

    try {
      const files = await fs.readdir(projectDir);
      const tsxFiles = files.filter(file => file.endsWith('.tsx'));

      const components: Component[] = tsxFiles.map(file => ({
        name: path.basename(file, '.tsx'),
        filepath: path.join(projectDir, file)
      }));

      return {
        status: 'success',
        message: `Found ${components.length} component(s)`,
        components
      };
    } catch {
      return {
        status: 'success',
        message: 'Found 0 component(s)',
        components: []
      };
    }
  }

  /**
   * Delete a component from a project
   */
  async deleteProjectComponent(projectId: string, name: string): Promise<ComponentResponse> {
    const projectDir = projectService.getProjectDir(projectId);
    const filepath = path.join(projectDir, `${name}.tsx`);

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
}

// Export singleton instance
export const fileService = new FileService();
