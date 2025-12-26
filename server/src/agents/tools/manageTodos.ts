import { v4 as uuidv4 } from 'uuid';
import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import type { AgentTodo } from '../../../../shared/types';

interface UpdateTodosParams {
  set?: string[];      // Set full list (names only), all start as pending
  start?: string;      // Mark one as in_progress
  complete?: string;   // Mark one as completed
}

// Per-project todo state (maintained server-side)
const projectTodos = new Map<string, AgentTodo[]>();


/**
 * UpdateTodos invocation
 */
class UpdateTodosInvocation implements ToolInvocation<UpdateTodosParams> {
  constructor(public params: UpdateTodosParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { projectId } = context;
    const { set, start, complete } = this.params;

    let todos = projectTodos.get(projectId) || [];
    const actions: string[] = [];

    // Handle 'set' - replace entire list
    if (set && set.length > 0) {
      todos = set.map((content) => ({
        id: uuidv4(),
        content,
        status: 'pending' as const,
        activeForm: content,
      }));
      actions.push(`Set ${set.length} tasks`);
    }

    // Handle 'complete' - mark task as completed
    if (complete) {
      const todo = todos.find(t => t.content === complete);
      if (todo) {
        todo.status = 'completed';
        actions.push(`Completed "${complete}"`);
      } else {
        return {
          success: false,
          output: `Task not found: "${complete}"`,
          todosUpdate: todos,
        };
      }
    }

    // Handle 'start' - mark task as in_progress
    if (start) {
      const todo = todos.find(t => t.content === start);
      if (todo) {
        todo.status = 'in_progress';
        actions.push(`Started "${start}"`);
      } else {
        return {
          success: false,
          output: `Task not found: "${start}"`,
          todosUpdate: todos,
        };
      }
    }

    // Save state
    projectTodos.set(projectId, todos);

    return {
      success: true,
      output: actions.join(', ') || 'No changes',
      todosUpdate: todos,
    };
  }
}

/**
 * UpdateTodos Tool - manages task list with delta updates
 */
export class ManageTodosTool implements BaseTool {
  name = 'update_todos';
  description = 'Manage your task list. Use "set" to create tasks, "start" to mark one in progress, "complete" to mark one done. You can combine start and complete in one call.';

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      set: {
        type: 'array',
        description: 'Replace task list with these items (all start as pending). Use short imperative phrases like "Create Hero", "Add navigation".',
        items: { type: 'string' }
      },
      start: {
        type: 'string',
        description: 'Task name to mark as in_progress (must match exactly)'
      },
      complete: {
        type: 'string',
        description: 'Task name to mark as completed (must match exactly)'
      }
    },
    [] // No required params - any combination is valid
  );

  build(params: unknown): ToolInvocation<UpdateTodosParams> {
    const p = params as UpdateTodosParams;
    return new UpdateTodosInvocation({
      set: p.set,
      start: p.start,
      complete: p.complete,
    });
  }
}

// Export helper to clear todos for a project (useful for cleanup)
export function clearProjectTodos(projectId: string): void {
  projectTodos.delete(projectId);
}
