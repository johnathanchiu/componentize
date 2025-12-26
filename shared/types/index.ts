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

// Agent-managed TODO item
export interface AgentTodo {
  id: string;
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
}

// Streaming Events - Discriminated Union
export type StreamEvent =
  | { type: 'thinking'; content: string }
  | { type: 'thinking_signature'; signature: string } // Required for multi-turn conversations
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; name: string; success: boolean; output?: string; canvas?: CanvasComponent; todos?: AgentTodo[] }
  | { type: 'complete'; content?: string }
  | { type: 'error'; message: string }

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
// Section-Based Layout Types
// ============================================================================

export interface PageStyle {
  width: number;
  background?: string;
}

export interface SectionComponent {
  name: string;
  size: { width: number; height: number };
  gap?: number; // Gap from previous component in section
}

export interface Section {
  name: string;
  layout: 'row' | 'column';
  components: SectionComponent[];
  gap?: number; // Gap between sections (default 40)
}

export interface Layer {
  name: string;
  type: 'modal' | 'drawer' | 'popover';
  components: string[];
  trigger?: {
    componentName: string;
    event: 'click' | 'hover';
  };
}

export interface LayoutState {
  pageStyle: PageStyle;
  sections: Section[];
  layers: Layer[];
}

// ============================================================================
// Layout DSL Types (Legacy)
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
