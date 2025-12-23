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

export interface GeneratePageRequest {
  prompt: string;
  pageName?: string;
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
  // New delta-based events (minecraftlm pattern)
  | 'turn_start'         // New agent turn starting
  | 'thinking_delta'     // Incremental thinking text (Claude's internal reasoning)
  | 'text_delta'         // Incremental response text (Claude's response to user)
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
  | 'page_plan'          // AI's plan for what components to create
  | 'component_start'    // Starting generation of a specific component
  | 'component_complete' // Component finished (success or failure)
  // Session events
  | 'session_start'      // Session started
  | 'user_message';      // User's message

export type StreamStatus = 'idle' | 'thinking' | 'acting' | 'success' | 'error';

// Agent-managed TODO item
export interface AgentTodo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

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
    // Block tracking (new simplified model)
    blockIndex?: number;        // Index of content block (for thinking/text/tool deltas)
    content?: string;           // For thinking/text events - the text content

    // Tool events
    toolName?: string;          // For tool events
    toolInput?: Record<string, unknown>;  // Tool parameters (sanitized)
    toolUseId?: string;         // For correlating tool_start with tool_result
    status?: 'success' | 'error';  // For tool_result and complete
    result?: unknown;           // Tool result data

    // Completion
    reason?: string;            // For complete event - why task ended

    // Canvas/Todo updates (embedded in tool_result)
    canvasComponent?: CanvasComponent;   // Component added to canvas
    todos?: AgentTodo[];                 // Updated todo list

    // Legacy fields (kept for backward compatibility during migration)
    iteration?: number;
    maxIterations?: number;
    partialCode?: string;
    code?: string;
    lineCount?: number;
    plan?: ComponentPlan[];
    componentIndex?: number;
    totalComponents?: number;
    componentName?: string;
    pageResult?: PageGenerationResult;
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

// ============================================================================
// Layout DSL Types
// ============================================================================

export type LayoutPrimitiveType = 'Stack' | 'Flex' | 'Grid' | 'Container';

// Props for each layout primitive
export interface StackLayoutProps {
  direction?: 'vertical' | 'horizontal';
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  padding?: number;
  className?: string;
}

export interface FlexLayoutProps {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  wrap?: boolean | 'reverse';
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  padding?: number;
  className?: string;
}

export interface GridLayoutProps {
  columns?: number | string;
  rows?: number | string;
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'stretch';
  padding?: number;
  className?: string;
}

export interface ContainerLayoutProps {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  center?: boolean;
  padding?: number;
  className?: string;
}

export type LayoutProps = StackLayoutProps | FlexLayoutProps | GridLayoutProps | ContainerLayoutProps;

// A child in a layout can be either a component reference or a nested layout
export type LayoutChild =
  | { component: string; props?: Record<string, unknown> }
  | LayoutDefinition;

// Layout definition (stored in layouts/{name}.json)
export interface LayoutDefinition {
  name?: string; // Optional for nested layouts
  type: LayoutPrimitiveType;
  props?: LayoutProps;
  children: LayoutChild[];
}

// Canvas layout item (what's stored in canvas.json)
export interface CanvasLayout {
  id: string;
  layoutName: string;
  position: Position;
  size?: Size;
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
