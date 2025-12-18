import type { Tool } from '../base';

export const COMPONENT_TOOLS: Tool[] = [
  {
    name: 'plan_components',
    description: 'Plan which components to create for a complex request. Use this for landing pages, dashboards, or any request requiring multiple components. Skip for simple single-component requests.',
    input_schema: {
      type: 'object',
      properties: {
        components: {
          type: 'array',
          description: 'List of components to create',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'PascalCase component name (e.g., HeroHeadline, PricingCard)'
              },
              description: {
                type: 'string',
                description: 'What this component should look like and do'
              },
              position: {
                type: 'object',
                description: 'Optional position on canvas',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' }
                }
              },
              size: {
                type: 'object',
                description: 'Optional size',
                properties: {
                  width: { type: 'number' },
                  height: { type: 'number' }
                }
              }
            },
            required: ['name', 'description']
          }
        }
      },
      required: ['components']
    }
  },
  {
    name: 'create_component',
    description: 'Create a new React TypeScript component and place it on the canvas. For simple requests, call this directly. For complex requests, call plan_components first.',
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
          description: 'Optional position on canvas. If omitted, defaults to center (400, 300)',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          }
        },
        size: {
          type: 'object',
          description: 'Optional size. If omitted, defaults to 300x200',
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
  },
  {
    name: 'create_layout',
    description: 'Compose multiple components using layout primitives (Stack, Flex, Grid, Container). Use this when components need to be arranged together (e.g., 3 cards in a row, hero with stacked content). Components must be created first before adding them to a layout.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Layout name in PascalCase (e.g., PricingSection, HeroArea)'
        },
        layout: {
          type: 'object',
          description: 'Layout definition using primitives',
          properties: {
            type: {
              type: 'string',
              enum: ['Stack', 'Flex', 'Grid', 'Container'],
              description: 'The layout primitive to use'
            },
            props: {
              type: 'object',
              description: 'Props for the layout primitive (gap, align, justify, direction, etc.)'
            },
            children: {
              type: 'array',
              description: 'Child elements - component references or nested layouts',
              items: {
                type: 'object'
              }
            }
          },
          required: ['type', 'children']
        },
        position: {
          type: 'object',
          description: 'Position on canvas for the layout',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          }
        },
        size: {
          type: 'object',
          description: 'Size of the layout container',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' }
          }
        }
      },
      required: ['name', 'layout']
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
