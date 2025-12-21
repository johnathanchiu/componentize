export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface EditComponentInput {
  name: string;
  code: string;
  position?: Position;
  size?: Size;
}

export interface ReadComponentInput {
  name: string;
}

export interface ManageTodosInput {
  todos: Array<{
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
}
