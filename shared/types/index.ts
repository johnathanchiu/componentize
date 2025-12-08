// ============================================================================
// Shared Types - Used by both frontend and backend
// ============================================================================

// Component Types
export interface Component {
  name: string;
  filepath: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface CanvasComponent {
  id: string;
  componentName: string;
  position: Position;
  size?: Size;
  interactions?: Interaction[];
}

// Interaction Types
export type InteractionType = 'onClick' | 'onChange' | 'onSubmit' | 'custom';

export interface StateVariable {
  name: string;
  initialValue: string | number | boolean;
  type: string;
}

export interface Interaction {
  id: string;
  type: InteractionType;
  description: string;
  handlerName: string;
  code: string;
  state?: StateVariable[];
}

// API Request Types
export interface GenerateComponentRequest {
  prompt: string;
  componentName: string;
}

export interface EditComponentRequest {
  componentName: string;
  editDescription: string;
}

export interface GenerateInteractionRequest {
  componentId: string;
  componentName: string;
  description: string;
  eventType: InteractionType;
}

export interface ExportPageRequest {
  pageName: string;
  layout: PageLayout;
  projectId: string;
}

// API Response Types
export interface APIResponse {
  status: 'success' | 'error';
  message: string;
}

export interface ComponentResponse extends APIResponse {
  component_name?: string;
  filepath?: string;
  content?: string;
}

export interface ListComponentsResponse extends APIResponse {
  components?: Component[];
}

export interface InteractionResponse extends APIResponse {
  interaction?: Interaction;
}

export interface ExportPageResponse extends APIResponse {
  page_name?: string;
  code?: string;
  filepath?: string;
  files?: ExportFile[];
}

export interface ExportFile {
  path: string;
  content: string;
}

// Streaming Event Types
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

// Page Layout Types
export interface PageLayout {
  components: Array<{
    componentName: string;
    position: Position;
    size?: Size;
    interactions?: Interaction[];
  }>;
}

// Visual Editing Types (for PropertyPanel)
export interface ComponentProperty {
  key: string;
  type: 'text' | 'color' | 'number' | 'boolean' | 'select';
  label: string;
  value: any;
  options?: string[];  // For select type
}

export interface PropertyUpdate {
  componentName: string;
  property: string;
  value: any;
}
