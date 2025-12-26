import fs from 'fs/promises';
import path from 'path';
import { projectService } from './projectService';

export interface ComponentResponse {
  status: 'success' | 'error';
  message: string;
  componentName?: string;
  filepath?: string;
  content?: string;
}

export interface Component {
  name: string;
  filepath: string;
}

export interface ListComponentsResponse {
  status: 'success' | 'error';
  message: string;
  components?: Component[];
}

class FileService {
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
    const explanatoryPhrases = ['here is', 'i have created', "i've created", 'this component', '## '];
    if (explanatoryPhrases.some((phrase) => codeLower.includes(phrase))) {
      return {
        valid: false,
        error: 'Code contains explanatory text. Please provide only TypeScript/React code.',
      };
    }

    // Check for minimum code patterns
    if (!codeLower.includes('function') && !codeLower.includes('const') && !code.includes('=>')) {
      return {
        valid: false,
        error: "Code doesn't appear to contain a valid React component.",
      };
    }

    return { valid: true };
  }

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
        message: `Component '${name}' already exists. Use update instead.`,
      };
    } catch {
      // File doesn't exist, proceed
    }

    try {
      await fs.writeFile(filepath, code, 'utf-8');
      return {
        status: 'success',
        message: `Component '${name}' created successfully`,
        componentName: name,
        filepath,
        content: code,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to create component: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        message: `Component '${name}' not found. Use create instead.`,
      };
    }

    try {
      await fs.writeFile(filepath, code, 'utf-8');
      return {
        status: 'success',
        message: `Component '${name}' updated successfully`,
        componentName: name,
        filepath,
        content: code,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to update component: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        componentName: name,
        filepath,
        content,
      };
    } catch {
      return {
        status: 'error',
        message: `Component '${name}' not found`,
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
      const tsxFiles = files.filter((file) => file.endsWith('.tsx'));

      const components: Component[] = tsxFiles.map((file) => ({
        name: path.basename(file, '.tsx'),
        filepath: path.join(basePath, file),
      }));

      return {
        status: 'success',
        message: `Found ${components.length} component(s)`,
        components,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to list components: ${error instanceof Error ? error.message : 'Unknown error'}`,
        components: [],
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
        componentName: name,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to delete component '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
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
}

export const fileService = new FileService();
