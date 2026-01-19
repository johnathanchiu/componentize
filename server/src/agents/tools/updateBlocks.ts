import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { projectService } from '../../services/projectService';
import { validateComponent } from '../validator';
import type { Block } from '../../../../shared/types';

interface BlockUpdate {
  _id: string;
  _name?: string;
  _position?: { x: number; y: number };
  _size?: { width: number; height: number };
  content?: string;
  styles?: string;
  tag?: string;
  level?: number;
  src?: string;
  alt?: string;
  href?: string;
  target?: string;
  variant?: string;
  size?: string | number;
  icon?: string;
  iconPosition?: string;
  name?: string;
  placeholder?: string;
  type?: string;
  label?: string;
  backgroundImage?: string;
  code?: string;
  componentName?: string;
}

interface UpdateBlocksParams {
  updates: BlockUpdate[];
}

/**
 * UpdateBlocks invocation - updates existing blocks
 */
class UpdateBlocksInvocation implements ToolInvocation<UpdateBlocksParams> {
  constructor(public params: UpdateBlocksParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { updates } = this.params;
    const { projectId } = context;

    // Validate that all block IDs exist
    const existingBlocks = await projectService.getBlocks(projectId);
    const existingIds = new Set(existingBlocks.blocks.map(b => b._id));

    for (const update of updates) {
      if (!existingIds.has(update._id)) {
        return {
          success: false,
          error: `Block with ID "${update._id}" not found`,
        };
      }
    }

    // Validate AIComponent code if being updated
    for (const update of updates) {
      if (update.code && update.componentName) {
        const validationError = validateComponent(update.code, update.componentName);
        if (validationError) {
          return {
            success: false,
            error: `Validation failed for AIComponent "${update.componentName}": ${validationError}`,
          };
        }
      }
    }

    // Convert updates to the format expected by projectService
    const blockUpdates: Array<{ _id: string } & Partial<Block>> = updates.map(update => {
      // Only include non-undefined properties
      const cleanUpdate: Record<string, unknown> = { _id: update._id };

      if (update._name !== undefined) cleanUpdate._name = update._name;
      if (update._position !== undefined) cleanUpdate._position = update._position;
      if (update._size !== undefined) cleanUpdate._size = update._size;
      if (update.content !== undefined) cleanUpdate.content = update.content;
      if (update.styles !== undefined) cleanUpdate.styles = update.styles;
      if (update.tag !== undefined) cleanUpdate.tag = update.tag;
      if (update.level !== undefined) cleanUpdate.level = update.level;
      if (update.src !== undefined) cleanUpdate.src = update.src;
      if (update.alt !== undefined) cleanUpdate.alt = update.alt;
      if (update.href !== undefined) cleanUpdate.href = update.href;
      if (update.target !== undefined) cleanUpdate.target = update.target;
      if (update.variant !== undefined) cleanUpdate.variant = update.variant;
      if (update.size !== undefined) cleanUpdate.size = update.size;
      if (update.icon !== undefined) cleanUpdate.icon = update.icon;
      if (update.iconPosition !== undefined) cleanUpdate.iconPosition = update.iconPosition;
      if (update.name !== undefined) cleanUpdate.name = update.name;
      if (update.placeholder !== undefined) cleanUpdate.placeholder = update.placeholder;
      if (update.type !== undefined) cleanUpdate.type = update.type;
      if (update.label !== undefined) cleanUpdate.label = update.label;
      if (update.backgroundImage !== undefined) cleanUpdate.backgroundImage = update.backgroundImage;
      if (update.code !== undefined) cleanUpdate.code = update.code;
      if (update.componentName !== undefined) cleanUpdate.componentName = update.componentName;

      return cleanUpdate as { _id: string } & Partial<Block>;
    });

    // Apply updates
    await projectService.updateBlocks(projectId, blockUpdates);

    // Get updated blocks to return
    const updatedBlocks = await projectService.getBlocks(projectId);
    const updatedBlocksResult = updates.map(u =>
      updatedBlocks.blocks.find(b => b._id === u._id)
    ).filter(Boolean) as Block[];

    // Build output
    const updateSummary = updates.map(u => u._id.substring(0, 8)).join(', ');

    return {
      success: true,
      output: `Updated ${updates.length} block(s): ${updateSummary}`,
      blocksUpdate: updatedBlocksResult,
    };
  }
}

/**
 * UpdateBlocks Tool - updates properties of existing blocks
 */
export class UpdateBlocksTool implements BaseTool {
  name = 'update_blocks';
  description = `Update properties of existing blocks.

Use this to modify block content, styles, position, size, or other properties.
Each update requires the block's _id and the properties to change.

Example - Update button text and style:
update_blocks({
  updates: [
    { _id: "abc123", content: "Click Me!", styles: "bg-blue-600 hover:bg-blue-700" }
  ]
})

Example - Move a block to a new position:
update_blocks({
  updates: [
    { _id: "abc123", _position: { x: 200, y: 300 }, _size: { width: 400, height: 200 } }
  ]
})

Example - Update AIComponent code:
update_blocks({
  updates: [
    { _id: "xyz789", code: "export default function Counter() { ... }" }
  ]
})`;

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      updates: {
        type: 'array',
        description: 'Array of block updates',
        items: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Block ID to update (required)',
            },
            _name: {
              type: 'string',
              description: 'Update display name',
            },
            _position: {
              type: 'object',
              description: 'Update position { x, y } on the canvas',
              properties: {
                x: { type: 'number', description: 'X coordinate in pixels' },
                y: { type: 'number', description: 'Y coordinate in pixels' },
              },
            },
            _size: {
              type: 'object',
              description: 'Update size { width, height }',
              properties: {
                width: { type: 'number', description: 'Width in pixels' },
                height: { type: 'number', description: 'Height in pixels' },
              },
            },
            content: {
              type: 'string',
              description: 'Update text content',
            },
            styles: {
              type: 'string',
              description: 'Update Tailwind CSS classes',
            },
            tag: {
              type: 'string',
              description: 'Update HTML tag',
            },
            level: {
              type: 'number',
              description: 'Update heading level (1-6)',
            },
            src: {
              type: 'string',
              description: 'Update image source',
            },
            alt: {
              type: 'string',
              description: 'Update image alt text',
            },
            href: {
              type: 'string',
              description: 'Update link URL',
            },
            target: {
              type: 'string',
              description: 'Update link target',
            },
            variant: {
              type: 'string',
              description: 'Update button variant',
            },
            size: {
              type: 'string',
              description: 'Update button/icon size',
            },
            icon: {
              type: 'string',
              description: 'Update button icon',
            },
            iconPosition: {
              type: 'string',
              description: 'Update icon position',
            },
            name: {
              type: 'string',
              description: 'Update icon name',
            },
            placeholder: {
              type: 'string',
              description: 'Update input placeholder',
            },
            type: {
              type: 'string',
              description: 'Update input type',
            },
            label: {
              type: 'string',
              description: 'Update input label',
            },
            backgroundImage: {
              type: 'string',
              description: 'Update background image',
            },
            code: {
              type: 'string',
              description: 'Update AIComponent code',
            },
            componentName: {
              type: 'string',
              description: 'Update AIComponent name',
            },
          },
          required: ['_id'],
        },
      },
    },
    ['updates']
  );

  build(params: unknown): ToolInvocation<UpdateBlocksParams> {
    const p = params as UpdateBlocksParams;
    return new UpdateBlocksInvocation({
      updates: p.updates,
    });
  }
}
