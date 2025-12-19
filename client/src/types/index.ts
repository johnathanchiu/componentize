export interface Component {
  name: string;
  filepath: string;
}

export interface CanvasComponent {
  id: string;
  componentName: string;
  position: Position;
  size?: Size;
  naturalSize?: Size;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PageLayout {
  components: CanvasComponent[];
}

export interface APIResponse {
  status: 'success' | 'error';
  message?: string;
}

export interface GenerateComponentResponse extends APIResponse {
  component_name?: string;
  filepath?: string;
}

export interface ListComponentsResponse extends APIResponse {
  components?: Component[];
  count?: number;
}

// Streaming events
export type StreamEventType =
  | 'session_start'
  | 'progress'
  | 'thinking'
  | 'tool_start'
  | 'tool_result'
  | 'code_streaming'
  | 'code_complete'
  | 'success'
  | 'error'
  | 'page_plan'
  | 'component_start'
  | 'component_complete'
  | 'canvas_update';

export type StreamStatus = 'idle' | 'thinking' | 'acting' | 'success' | 'error';

// Component plan from AI
export interface ComponentPlan {
  name: string;
  description: string;
  position?: Position;
  size?: Size;
}

// Page generation result
export interface PageGenerationResult {
  totalComponents: number;
  successfulComponents: string[];
  failedComponents: Array<{ name: string; error: string }>;
  canvasComponents: CanvasComponent[];
}

// Agent-managed todo items (from manage_todos tool)
export interface AgentTodo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface StreamEvent {
  type: StreamEventType;
  message: string;
  timestamp: number;
  data?: {
    content?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolUseId?: string;
    iteration?: number;
    maxIterations?: number;
    status?: 'success' | 'error';
    result?: unknown;
    mode?: 'create' | 'edit' | 'fix';
    componentName?: string;
    partialCode?: string;
    code?: string;
    lineCount?: number;
    plan?: ComponentPlan[];
    componentIndex?: number;
    totalComponents?: number;
    canvasComponent?: CanvasComponent;
    pageResult?: PageGenerationResult;
  };
}
