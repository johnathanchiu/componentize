import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { projectService } from '../../services/projectService';

interface RemoveBlocksParams {
  blockIds: string[];
}

/**
 * RemoveBlocks invocation - removes blocks by ID
 */
class RemoveBlocksInvocation implements ToolInvocation<RemoveBlocksParams> {
  constructor(public params: RemoveBlocksParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { blockIds } = this.params;
    const { projectId } = context;

    if (blockIds.length === 0) {
      return {
        success: false,
        error: 'No block IDs provided',
      };
    }

    // Validate that all block IDs exist
    const existingBlocks = await projectService.getBlocks(projectId);
    const existingIds = new Set(existingBlocks.blocks.map(b => b._id));

    const missingIds = blockIds.filter(id => !existingIds.has(id));
    if (missingIds.length > 0) {
      return {
        success: false,
        error: `Block(s) not found: ${missingIds.join(', ')}`,
      };
    }

    // Remove blocks (this also removes children recursively)
    await projectService.removeBlocks(projectId, blockIds);

    return {
      success: true,
      output: `Removed ${blockIds.length} block(s) and their children`,
      blocksRemoved: blockIds,
    };
  }
}

/**
 * RemoveBlocks Tool - removes blocks by their IDs
 */
export class RemoveBlocksTool implements BaseTool {
  name = 'remove_blocks';
  description = `Remove blocks from the page by their IDs.

This will also remove all child blocks recursively.
Use get_blocks first to see the current block structure and find block IDs.

Example - Remove a section:
remove_blocks({
  blockIds: ["hero-section-id"]
})

Example - Remove multiple blocks:
remove_blocks({
  blockIds: ["block-1", "block-2", "block-3"]
})`;

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      blockIds: {
        type: 'array',
        description: 'Array of block IDs to remove',
        items: {
          type: 'string',
        },
      },
    },
    ['blockIds']
  );

  build(params: unknown): ToolInvocation<RemoveBlocksParams> {
    const p = params as RemoveBlocksParams;
    return new RemoveBlocksInvocation({
      blockIds: p.blockIds,
    });
  }
}
