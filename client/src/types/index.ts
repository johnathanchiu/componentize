export interface Component {
  name: string;
  filepath: string;
}

export interface CanvasComponent {
  id: string;
  componentName: string;
  position: Position;
  size?: Size;
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

// Streaming events - new delta-based pattern
export type StreamEventType =
  // Session events
  | 'session_start'
  | 'user_message'
  // New delta-based events (minecraftlm pattern)
  | 'turn_start'         // New agent turn starting
  | 'thinking_delta'     // Incremental thinking text (append to existing)
  | 'text_delta'         // Incremental text response (for extended thinking)
  | 'tool_call'          // Tool being called (with id, name, args)
  | 'tool_result'        // Tool execution completed
  | 'code_delta'         // Incremental code generation
  | 'canvas_update'      // Component placed on canvas
  | 'todo_update'        // Agent-managed TODO list update
  | 'complete'           // Task finished (success or error)
  | 'error'              // Error occurred
  // Legacy events (kept for backward compatibility)
  | 'progress'           // Generic status updates
  | 'thinking'           // Claude's reasoning text (full chunks) - legacy
  | 'tool_start'         // Tool call initiated - legacy (use tool_call)
  | 'code_streaming'     // Partial code being generated - legacy
  | 'code_complete'      // Full code generation finished - legacy
  | 'success'            // Final success - legacy (use complete)
  // Page generation specific events
  | 'page_plan'
  | 'component_start'
  | 'component_complete';

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
    prompt?: string; // User message content
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
    todos?: AgentTodo[];
  };
}
