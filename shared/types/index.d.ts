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
}
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
export type StreamEventType = 'progress' | 'success' | 'error' | 'thinking' | 'tool_call';
export interface StreamEvent {
    type: StreamEventType;
    message: string;
    data?: any;
}
export interface PageLayout {
    components: Array<{
        componentName: string;
        position: Position;
        size?: Size;
        interactions?: Interaction[];
    }>;
}
export interface ComponentProperty {
    key: string;
    type: 'text' | 'color' | 'number' | 'boolean' | 'select';
    label: string;
    value: any;
    options?: string[];
}
export interface PropertyUpdate {
    componentName: string;
    property: string;
    value: any;
}
//# sourceMappingURL=index.d.ts.map