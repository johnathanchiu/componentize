import { BaseAgent, type Tool, type ToolResult } from './baseAgent';
import { fileService } from '../services/fileService';
import type { StreamEvent } from '../../../shared/types';

const COMPONENT_TOOLS: Tool[] = [
  {
    name: 'create_component',
    description: 'Create a new React TypeScript component file with Tailwind CSS styling.',
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
    name: 'update_component',
    description: 'Update an existing React component file with new code.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the component to update'
        },
        code: {
          type: 'string',
          description: 'The updated React component code'
        }
      },
      required: ['name', 'code']
    }
  }
];

export class ComponentAgent extends BaseAgent {
  constructor() {
    super(COMPONENT_TOOLS);
  }

  protected async executeTool(toolName: string, toolInput: any): Promise<ToolResult> {
    const { name, code } = toolInput;

    switch (toolName) {
      case 'create_component':
        return await fileService.createComponent(name, code);

      case 'update_component':
        return await fileService.updateComponent(name, code);

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
    yield { type: 'progress', message: `Generating component '${componentName}'...` };

    const messages = [
      {
        role: 'user' as const,
        content: `Create a React TypeScript component named '${componentName}' based on this description:

${prompt}

Requirements:
- Use TypeScript with proper type definitions
- Use Tailwind CSS for all styling
- Make it a functional component with export default
- Make it responsive and accessible
- Include any necessary props with TypeScript interfaces
- Use modern React patterns (hooks if needed)

IMPORTANT: You must use the create_component tool to save the component. Do not just describe the component - actually call the create_component tool with the full component code.`
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
    yield { type: 'progress', message: `Reading component '${componentName}'...` };

    // Read existing component
    const readResult = await fileService.readComponent(componentName);

    if (readResult.status !== 'success') {
      yield { type: 'error', message: `Component '${componentName}' not found` };
      return;
    }

    const existingCode = readResult.content!;

    yield { type: 'progress', message: 'Preparing edit instructions...' };

    const messages = [
      {
        role: 'user' as const,
        content: `Please edit the React TypeScript component '${componentName}' based on this description:

${editDescription}

Here is the current component code:

\`\`\`tsx
${existingCode}
\`\`\`

Requirements:
- Maintain TypeScript with proper type definitions
- Keep using Tailwind CSS for styling
- Keep it as a functional component with export default
- Preserve the core functionality while making the requested changes
- Use modern React patterns

IMPORTANT: You must use the update_component tool to save the modified component. Do not just describe the component - actually call the update_component tool with the full component code.`
      }
    ];

    // Run agent loop
    yield* this.runAgentLoop(messages, (result) => {
      return result.status === 'success' && result.component_name === componentName;
    });
  }
}

// Export singleton instance
export const componentAgent = new ComponentAgent();
