import type { AgentTodo } from '@/shared/types';

interface TodoListProps {
  todos: AgentTodo[];
}

export function TodoList({ todos }: TodoListProps) {
  if (todos.length === 0) return null;

  const completedCount = todos.filter((t) => t.status === 'completed').length;

  return (
    <div className="mb-3 px-2 py-2 bg-neutral-50 rounded-lg border border-neutral-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-neutral-600">
          Tasks: {completedCount}/{todos.length}
        </span>
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {todos.map((todo) => (
          <div
            key={todo.id}
            className={`flex items-center gap-2 text-xs ${
              todo.status === 'completed'
                ? 'text-green-600'
                : todo.status === 'in_progress'
                  ? 'text-blue-600'
                  : 'text-neutral-500'
            }`}
          >
            <span className="w-4 text-center">
              {todo.status === 'completed'
                ? '✓'
                : todo.status === 'in_progress'
                  ? '→'
                  : '○'}
            </span>
            <span className={todo.status === 'completed' ? 'line-through' : ''}>
              {todo.status === 'in_progress' && todo.activeForm
                ? todo.activeForm
                : todo.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
