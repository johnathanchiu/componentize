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
export type StreamEventType = 'progress' | 'success' | 'error' | 'thinking' | 'tool_call';

export interface StreamEvent {
  type: StreamEventType;
  message: string;
  data?: any;
}
