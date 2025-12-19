export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PlanComponentsInput {
  components: Array<{
    name: string;
    description: string;
    position?: Position;
    size?: Size;
  }>;
}

export interface CreateComponentInput {
  name: string;
  code: string;
  position?: Position;
  size?: Size;
}

export interface ManageTodosInput {
  todos: Array<{
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
}

export interface ReadComponentInput {
  name: string;
}

export interface UpdateComponentInput {
  name: string;
  code: string;
}
