import type { BaseTool, ToolResult, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import type { AgentTodo } from '../../../../shared/types';

interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

interface ManageTodosParams {
  todos: TodoItem[];
}

/**
 * ManageTodos invocation
 */
class ManageTodosInvocation implements ToolInvocation<ManageTodosParams> {
  constructor(public params: ManageTodosParams) {}

  async execute(): Promise<ToolResult> {
    const { todos } = this.params;

    // Auto-generate IDs for each todo (index-based for stability)
    const todosWithIds: AgentTodo[] = todos.map((todo, index) => ({
      id: `todo-${index}`,
      content: todo.content,
      status: todo.status,
      activeForm: todo.activeForm,
    }));

    return {
      success: true,
      output: `Updated ${todos.length} tasks`,
      todosUpdate: todosWithIds,
    };
  }
}

/**
 * ManageTodos Tool - manages task list for the agent
 */
export class ManageTodosTool implements BaseTool {
  name = 'manage_todos';
  description = 'Create and update a task list to track progress. Use this to plan work and show progress to the user.';

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      todos: {
        type: 'array',
        description: 'The complete list of tasks with their current status',
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Task description in imperative form (e.g., "Create Hero component")'
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: 'Current status of the task'
            },
            activeForm: {
              type: 'string',
              description: 'Task description in present continuous form (e.g., "Creating Hero component")'
            }
          },
          required: ['content', 'status', 'activeForm']
        }
      }
    },
    ['todos']
  );

  build(params: unknown): ToolInvocation<ManageTodosParams> {
    const p = params as ManageTodosParams;
    return new ManageTodosInvocation({ todos: p.todos });
  }
}
