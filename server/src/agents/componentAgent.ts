import { BaseAgent, type Tool, type ToolResult } from './baseAgent';
import { fileService } from '../services/fileService';
import type { StreamEvent } from '../../../shared/types';

const COMPONENT_TOOLS: Tool[] = [
  {
    name: 'create_component',
    description: 'Create a new React TypeScript component file with Tailwind CSS styling. Use this for new components.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Component name in PascalCase (e.g., Button, PricingCard, HeroSection)'
        },
        code: {
          type: 'string',
          description: 'The complete React TypeScript component code including imports, types, and export'
        }
      },
      required: ['name', 'code']
    }
  },
  {
    name: 'read_component',
    description: 'Read the current code of an existing component. Use this before updating to see the current implementation.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the component to read'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'update_component',
    description: 'Update an existing React component file with new code. Always provide the COMPLETE updated code, not just the changes.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the component to update'
        },
        code: {
          type: 'string',
          description: 'The COMPLETE updated React component code (not a diff, the full file)'
        }
      },
      required: ['name', 'code']
    }
  }
];

const COMPONENT_SYSTEM_PROMPT = `You are an expert React/TypeScript developer. Your ONLY job is to write and modify React components.

CRITICAL RULES - FOLLOW EXACTLY:
1. ALWAYS use tools. Never respond with just text.
2. When creating: call create_component with the complete code.
3. When editing: first call read_component, then call update_component with the COMPLETE updated code.
4. When fixing errors: read the component, identify the bug, fix it, and save with update_component.
5. NEVER ask questions. Make reasonable decisions and proceed.
6. NEVER explain what you'll do. Just do it.
7. Write working code on the first attempt.

CODE REQUIREMENTS:
- TypeScript with proper types (no 'any' unless necessary)
- Tailwind CSS for all styling (no inline styles, no CSS files)
- Functional components with hooks
- Accessible (aria-labels, semantic HTML)
- Export as default
- Handle edge cases (loading, error, empty states)`;

export class ComponentAgent extends BaseAgent {
  constructor() {
    super(COMPONENT_TOOLS, COMPONENT_SYSTEM_PROMPT);
  }

  protected async executeTool(toolName: string, toolInput: unknown): Promise<ToolResult> {
    switch (toolName) {
      case 'create_component': {
        const { name, code } = toolInput as { name: string; code: string };
        const result = await fileService.createComponent(name, code);
        return { ...result, component_name: result.component_name };
      }

      case 'read_component': {
        const { name } = toolInput as { name: string };
        const result = await fileService.readComponent(name);
        if (result.status === 'success') {
          return {
            status: 'success',
            message: `Component '${name}' code:`,
            code: result.content,
            component_name: name,
            action: 'read',  // Mark as read action so we don't stop the loop
          };
        }
        return {
          status: result.status,
          message: result.message,
        };
      }

      case 'update_component': {
        const { name, code } = toolInput as { name: string; code: string };
        const result = await fileService.updateComponent(name, code);
        return { ...result, component_name: result.component_name };
      }

      default:
        return {
          status: 'error',
          message: `Unknown tool: ${toolName}`
        };
    }
  }

  /**
   * Generate a new component with streaming
   */
  async *generateComponent(prompt: string, componentName: string): AsyncGenerator<StreamEvent> {
    yield { type: 'progress', message: `Creating '${componentName}'...`, timestamp: Date.now() };

    const messages = [
      {
        role: 'user' as const,
        content: `Create component "${componentName}": ${prompt}

Call create_component now.`
      }
    ];

    // Run agent loop
    yield* this.runAgentLoop(messages, (result) => {
      return result.status === 'success' && result.component_name === componentName;
    });
  }

  /**
   * Edit an existing component with streaming
   */
  async *editComponent(componentName: string, editDescription: string): AsyncGenerator<StreamEvent> {
    yield { type: 'progress', message: `Editing '${componentName}'...`, timestamp: Date.now() };

    // Check component exists
    const exists = await fileService.readComponent(componentName);
    if (exists.status !== 'success') {
      yield { type: 'error', message: `Component '${componentName}' not found`, timestamp: Date.now() };
      return;
    }

    const messages = [
      {
        role: 'user' as const,
        content: `Edit component "${componentName}": ${editDescription}

Steps:
1. Call read_component to get current code
2. Fix the issue
3. Call update_component with the complete fixed code

Start now.`
      }
    ];

    // Run agent loop - only stop on successful update, not on read
    yield* this.runAgentLoop(messages, (result) => {
      return result.status === 'success' &&
             result.component_name === componentName &&
             result.action !== 'read';
    });
  }
}

// Export singleton instance
export const componentAgent = new ComponentAgent();
