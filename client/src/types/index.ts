export interface Component {
  name: string;
  filepath: string;
}

export interface CanvasComponent {
  id: string;
  componentName: string;
  position: Position;
  size?: Size;
  interactions?: Interaction[];
}

export interface Interaction {
  id: string;
  type: 'onClick' | 'onChange' | 'onSubmit' | 'custom';
  description: string;
  handlerName: string;
  code: string;
  state?: StateVariable[];
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

export interface ExportPageResponse extends APIResponse {
  page_name?: string;
  filepath?: string;
  code?: string;
}

export interface StateVariable {
  name: string;
  type: string;
  initialValue: any;
}

export interface GenerateInteractionResponse extends APIResponse {
  interaction?: Interaction;
}

// Streaming events
export type StreamEventType =
  | 'progress'      // Generic status updates
  | 'thinking'      // Claude's reasoning text (streamed in chunks)
  | 'tool_start'    // Tool call initiated (with tool name & params)
  | 'tool_result'   // Tool execution completed
  | 'success'       // Final success
  | 'error';        // Error occurred

export type StreamStatus = 'idle' | 'thinking' | 'acting' | 'success' | 'error';

export interface StreamEvent {
  type: StreamEventType;
  message: string;
  timestamp: number;
  data?: {
    content?: string;           // For thinking events - the reasoning text
    toolName?: string;          // For tool events
    toolInput?: Record<string, unknown>;  // Tool parameters (sanitized)
    toolUseId?: string;         // For correlating tool_start with tool_result
    iteration?: number;         // Current iteration
    maxIterations?: number;     // Max iterations allowed
    status?: 'success' | 'error';  // For tool_result
    result?: unknown;           // Tool result data
  };
}
