// ============================================================================
// Shared Types - Used by both frontend and backend
// ============================================================================

// ============================================================================
// Block-Based Data Model (Inspired by Chaibuilder)
// ============================================================================

/**
 * Base block type - all blocks have these internal properties
 * Underscore prefix indicates internal/system properties (chaibuilder convention)
 */
export interface BaseBlock {
  _id: string;
  _type: string;
  _parent: string | null;  // Parent block ID for nesting
  _name?: string;          // Display name in tree view
}

/**
 * Standard block types with their specific props
 */

// Box - Container element (div, section, header, etc.)
export interface BoxBlock extends BaseBlock {
  _type: 'Box';
  tag?: 'div' | 'section' | 'header' | 'footer' | 'article' | 'aside' | 'main' | 'nav';
  styles?: string;  // Tailwind classes
  backgroundImage?: string;
}

// Text - Paragraph or span
export interface TextBlock extends BaseBlock {
  _type: 'Text';
  content: string;
  tag?: 'p' | 'span';
  styles?: string;
}

// Heading - H1-H6
export interface HeadingBlock extends BaseBlock {
  _type: 'Heading';
  content: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  styles?: string;
}

// Button
export interface ButtonBlock extends BaseBlock {
  _type: 'Button';
  content: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg';
  styles?: string;
  icon?: string;  // Lucide icon name
  iconPosition?: 'left' | 'right';
}

// Image
export interface ImageBlock extends BaseBlock {
  _type: 'Image';
  src: string;
  alt: string;
  styles?: string;
}

// Link
export interface LinkBlock extends BaseBlock {
  _type: 'Link';
  content: string;
  href: string;
  target?: '_self' | '_blank';
  styles?: string;
}

// Icon - Lucide icon
export interface IconBlock extends BaseBlock {
  _type: 'Icon';
  name: string;  // Lucide icon name
  size?: number;
  styles?: string;
}

// Input
export interface InputBlock extends BaseBlock {
  _type: 'Input';
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number';
  label?: string;
  styles?: string;
}

/**
 * AIComponent - Our special block type for AI-generated React components
 * This is the differentiator from chaibuilder - full React code with hooks
 */
export interface AIComponentBlock extends BaseBlock {
  _type: 'AIComponent';
  code: string;           // Full React component code
  componentName: string;  // Name of the component function
}

/**
 * Union type of all block types
 */
export type Block =
  | BoxBlock
  | TextBlock
  | HeadingBlock
  | ButtonBlock
  | ImageBlock
  | LinkBlock
  | IconBlock
  | InputBlock
  | AIComponentBlock;

/**
 * Block type string union for type guards
 */
export type BlockType = Block['_type'];

/**
 * Type guard helpers - use inline checks like `block._type === 'AIComponent'`
 * Functions exported from shared/ can cause issues with Vite's module handling
 */

/**
 * Block registry for editor - metadata about each block type
 */
export interface BlockDefinition {
  type: BlockType;
  label: string;
  description: string;
  category: 'layout' | 'typography' | 'interactive' | 'media' | 'ai';
  icon?: string;  // Lucide icon name
  canAcceptChildren: boolean;
  defaultProps: Partial<Block>;
}

/**
 * Project state - the new format
 */
export interface ProjectBlocks {
  blocks: Block[];
  // Theme tokens (for later)
  theme?: {
    colors?: Record<string, string>;
    fonts?: { heading?: string; body?: string };
    radius?: string;
  };
}

// ============================================================================
// Legacy Types (keeping for now, will migrate away)
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
  componentName?: string;
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
  | { type: 'tool_result'; id: string; name: string; success: boolean; output?: string; canvas?: CanvasComponent; canvasUpdates?: CanvasComponent[]; todos?: AgentTodo[]; layout?: LayoutState; blocks?: Block[]; blocksRemoved?: string[] }
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
