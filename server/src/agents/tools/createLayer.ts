import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { projectService } from '../../services/projectService';
import type { Layer } from '../../../../shared/types';

interface CreateLayerParams {
  name: string;
  type: 'modal' | 'drawer' | 'popover';
  components: string[];
  triggerComponent?: string;
  triggerEvent?: 'click' | 'hover';
}

/**
 * CreateLayer invocation
 */
class CreateLayerInvocation implements ToolInvocation<CreateLayerParams> {
  constructor(public params: CreateLayerParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { projectId } = context;
    const { name, type, components, triggerComponent, triggerEvent } = this.params;

    const layer: Layer = {
      name,
      type,
      components,
    };

    if (triggerComponent && triggerEvent) {
      layer.trigger = {
        componentName: triggerComponent,
        event: triggerEvent,
      };
    }

    await projectService.upsertLayer(projectId, layer);

    const triggerInfo = layer.trigger
      ? ` Triggered by ${triggerComponent} on ${triggerEvent}.`
      : ' No trigger set.';

    return {
      success: true,
      output: `Created ${type} layer "${name}" with components: ${components.join(', ')}.${triggerInfo}`,
    };
  }
}

/**
 * CreateLayer Tool - create overlay layers (modals, drawers, popovers)
 */
export class CreateLayerTool implements BaseTool {
  name = 'create_layer';
  description = `Create an overlay layer for modals, drawers, or popovers.

Layers appear above the main page content and can be triggered by component interactions.

Layer types:
- modal: Centered overlay with backdrop
- drawer: Slides in from edge
- popover: Positioned near trigger element

Example workflow:
1. Create components for the layer content (e.g., SignupModalContent)
2. Create the layer with those components
3. Set a trigger to open the layer when a button is clicked`;

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      name: {
        type: 'string',
        description: 'Layer name (e.g., "signup-modal", "nav-drawer", "user-menu")'
      },
      type: {
        type: 'string',
        enum: ['modal', 'drawer', 'popover'],
        description: 'Layer type: modal (centered), drawer (slides in), or popover (positioned)'
      },
      components: {
        type: 'array',
        items: { type: 'string' },
        description: 'Component names to include in this layer'
      },
      triggerComponent: {
        type: 'string',
        description: 'Name of the component that triggers this layer to open'
      },
      triggerEvent: {
        type: 'string',
        enum: ['click', 'hover'],
        description: 'Event type that triggers the layer (click or hover)'
      },
    },
    ['name', 'type', 'components']
  );

  build(params: unknown): ToolInvocation<CreateLayerParams> {
    const p = params as CreateLayerParams;
    return new CreateLayerInvocation({
      name: p.name,
      type: p.type,
      components: p.components,
      triggerComponent: p.triggerComponent,
      triggerEvent: p.triggerEvent,
    });
  }
}
