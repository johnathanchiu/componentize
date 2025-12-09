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
  | 'session_start'      // New generation/edit session started
  | 'progress'           // Generic status updates
  | 'thinking'           // Claude's reasoning text (streamed in chunks)
  | 'tool_start'         // Tool call initiated (with tool name & params)
  | 'tool_result'        // Tool execution completed
  | 'code_streaming'     // Partial code being generated (real-time updates)
  | 'code_complete'      // Full code generation finished for a component
  | 'success'            // Final success
  | 'error'              // Error occurred
  // Page generation specific events
  | 'page_plan'          // AI's plan for what components to create
  | 'component_start'    // Starting generation of a specific component
  | 'component_complete' // Component finished (success or failure)
  | 'canvas_update';     // Component placed on canvas

export type StreamStatus = 'idle' | 'thinking' | 'acting' | 'success' | 'error';

// Layout hint for smart positioning
export type LayoutHint =
  | 'hero'
  | 'header'
  | 'sidebar'
  | 'cards'
  | 'content'
  | 'cta'
  | 'form'
  | 'footer'
  | 'table'
  | 'stats';

// Component plan from AI
export interface ComponentPlan {
  name: string;
  description: string;
  layoutHint?: LayoutHint;
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
    mode?: 'create' | 'edit' | 'fix';  // For session_start - what type of session
    componentName?: string;     // For session_start or component events
    // Code streaming fields
    partialCode?: string;        // For code_streaming - partial code being generated
    code?: string;               // For code_complete - full generated code
    lineCount?: number;          // Number of lines in the code
    // Page generation specific fields
    plan?: ComponentPlan[];              // For page_plan event
    componentIndex?: number;             // Current component (1-indexed)
    totalComponents?: number;            // Total in plan
    canvasComponent?: CanvasComponent;   // For canvas_update event
    pageResult?: PageGenerationResult;   // For final success event
  };
}
