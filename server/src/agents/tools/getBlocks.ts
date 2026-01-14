import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { projectService } from '../../services/projectService';
import type { Block } from '../../../../shared/types';

interface GetBlocksParams {
  includeCode?: boolean;
}

/**
 * Format blocks as a hierarchical tree string
 */
function formatBlockTree(blocks: Block[], includeCode: boolean): string {
  // Build parent-child map
  const childrenMap: Record<string, Block[]> = {};
  const rootBlocks: Block[] = [];

  blocks.forEach(block => {
    if (block._parent) {
      if (!childrenMap[block._parent]) {
        childrenMap[block._parent] = [];
      }
      childrenMap[block._parent].push(block);
    } else {
      rootBlocks.push(block);
    }
  });

  // Recursive tree formatter
  function formatNode(block: Block, indent: number): string {
    const prefix = '  '.repeat(indent);
    const name = block._name ? ` "${block._name}"` : '';

    let props = '';
    if (block._type === 'Text' || block._type === 'Heading' || block._type === 'Button' || block._type === 'Link') {
      const content = (block as { content?: string }).content;
      if (content) {
        const truncated = content.length > 40 ? content.substring(0, 40) + '...' : content;
        props = ` content="${truncated}"`;
      }
    }
    if (block._type === 'Heading') {
      props += ` level=${(block as { level: number }).level}`;
    }
    if (block._type === 'AIComponent') {
      const componentName = (block as { componentName: string }).componentName;
      props += ` componentName="${componentName}"`;
      if (includeCode) {
        const code = (block as { code: string }).code;
        props += `\n${prefix}  code: """\n${code.split('\n').map(l => prefix + '    ' + l).join('\n')}\n${prefix}  """`;
      }
    }

    let line = `${prefix}├─ ${block._type}${name} (${block._id})${props}`;

    const children = childrenMap[block._id] || [];
    if (children.length > 0) {
      line += '\n' + children.map(child => formatNode(child, indent + 1)).join('\n');
    }

    return line;
  }

  if (rootBlocks.length === 0) {
    return '(No blocks)';
  }

  return rootBlocks.map(block => formatNode(block, 0)).join('\n');
}

/**
 * GetBlocks invocation - retrieves current block structure
 */
class GetBlocksInvocation implements ToolInvocation<GetBlocksParams> {
  constructor(public params: GetBlocksParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { includeCode = false } = this.params;
    const { projectId } = context;

    const projectBlocks = await projectService.getBlocks(projectId);
    const blocks = projectBlocks.blocks;

    if (blocks.length === 0) {
      return {
        success: true,
        output: 'No blocks on the page yet.',
      };
    }

    const treeOutput = formatBlockTree(blocks, includeCode);
    const summary = `Page has ${blocks.length} block(s):\n\n${treeOutput}`;

    return {
      success: true,
      output: summary,
    };
  }
}

/**
 * GetBlocks Tool - retrieves current block structure
 */
export class GetBlocksTool implements BaseTool {
  name = 'get_blocks';
  description = `Get the current block structure of the page.

Returns a hierarchical tree view of all blocks with their IDs, types, and content.
Use this to see what exists before making changes.

Example output:
├─ Box "Hero Section" (abc-123)
│  ├─ Heading "Main Title" (def-456) content="Welcome" level=1
│  ├─ Text (ghi-789) content="Start building today"
│  └─ Button (jkl-012) content="Get Started"
├─ Box "Features" (mno-345)
│  └─ AIComponent (pqr-678) componentName="FeatureGrid"`;

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      includeCode: {
        type: 'boolean',
        description: 'Include full code for AIComponent blocks (default: false)',
      },
    },
    []
  );

  build(params: unknown): ToolInvocation<GetBlocksParams> {
    const p = (params || {}) as GetBlocksParams;
    return new GetBlocksInvocation({
      includeCode: p.includeCode,
    });
  }
}
