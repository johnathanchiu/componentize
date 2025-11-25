import { BaseAgent, type Tool, type ToolResult } from './baseAgent';
import type { StreamEvent, Interaction, StateVariable } from '../../../shared/types';

const INTERACTION_TOOLS: Tool[] = [
  {
    name: 'create_interaction',
    description: 'Create an interaction/event handler for a component with generated code and state.',
    input_schema: {
      type: 'object',
      properties: {
        handlerName: {
          type: 'string',
          description: 'Name of the event handler function (e.g., handleClick, handleSubmit)'
        },
        code: {
          type: 'string',
          description: 'The complete event handler code'
        },
        state: {
          type: 'array',
          description: 'State variables needed for this interaction',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              initialValue: { type: ['string', 'number', 'boolean'] },
              type: { type: 'string' }
            },
            required: ['name', 'initialValue', 'type']
          }
        }
      },
      required: ['handlerName', 'code']
    }
  }
];

export class InteractionAgent extends BaseAgent {
  constructor() {
    super(INTERACTION_TOOLS);
  }

  protected async executeTool(toolName: string, toolInput: any): Promise<ToolResult> {
    if (toolName === 'create_interaction') {
      return {
        status: 'success',
        message: 'Interaction created successfully',
        ...toolInput
      };
    }

    return {
      status: 'error',
      message: `Unknown tool: ${toolName}`
    };
  }

  /**
   * Generate an interaction with streaming
   */
  async *generateInteraction(
    componentId: string,
    componentName: string,
    description: string,
    eventType: string
  ): AsyncGenerator<StreamEvent> {
    yield { type: 'progress', message: `Generating ${eventType} interaction...` };

    const messages = [
      {
        role: 'user' as const,
        content: `Create a React event handler for the '${componentName}' component.

Event Type: ${eventType}
Description: ${description}

Requirements:
- Generate a clean, working event handler function
- Include any necessary state variables (using useState)
- Use TypeScript
- Follow React best practices
- The code should be ready to integrate into a React component

IMPORTANT: Use the create_interaction tool to return the handler name, code, and any state variables needed. Do not just describe it - actually call the tool.`
      }
    ];

    let capturedInteraction: Interaction | null = null;

    // Run agent loop
    for await (const event of this.runAgentLoop(messages, (result) => {
      if (result.status === 'success' && result.handlerName) {
        // Capture the interaction data
        capturedInteraction = {
          id: `${componentId}-${Date.now()}`,
          type: eventType as any,
          description,
          handlerName: result.handlerName,
          code: result.code,
          state: result.state as StateVariable[] | undefined
        };
        return true;
      }
      return false;
    })) {
      yield event;
    }

    // Return the captured interaction if successful
    if (capturedInteraction) {
      yield {
        type: 'success',
        message: 'Interaction created successfully',
        data: { interaction: capturedInteraction }
      };
    }
  }
}

// Export singleton instance
export const interactionAgent = new InteractionAgent();
