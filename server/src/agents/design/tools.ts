import type { Tool } from '../base';

export const DESIGN_TOOLS: Tool[] = [
  {
    name: 'read_component',
    description: 'Read the current code of an existing component. Use this before editing to see the current implementation.',
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
    name: 'edit_component',
    description: 'Create a new component or update an existing one. If the component exists, it will be updated. If not, it will be created and placed on the canvas.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Component name in PascalCase (e.g., Button, PricingCard)'
        },
        code: {
          type: 'string',
          description: 'The complete React TypeScript component code including imports, types, and export'
        },
        position: {
          type: 'object',
          description: 'Optional position on canvas (only used when creating new components). If omitted, auto-positions based on existing components.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          }
        },
        size: {
          type: 'object',
          description: 'Optional size (only used when creating new components). If omitted, defaults to 300x200.',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' }
          }
        }
      },
      required: ['name', 'code']
    }
  },
  {
    name: 'manage_todos',
    description: 'Manage your task list. Use this to plan work, track progress, and show users what you are doing. Call this BEFORE starting work to create tasks, and after completing each task to mark it done.',
    input_schema: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'The complete updated todo list',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique ID for the todo (e.g., "task-1")' },
              content: { type: 'string', description: 'Task description' },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed'],
                description: 'Task status'
              }
            },
            required: ['id', 'content', 'status']
          }
        }
      },
      required: ['todos']
    }
  }
];
