import { v4 as uuidv4 } from 'uuid';
import type { BaseTool, ToolResult, ToolContext, ToolInvocation, ToolSchema } from './base';
import { makeToolSchema } from './base';
import { projectService } from '../../services/projectService';
import { validateComponent } from '../validator';
import type { Block, AIComponentBlock } from '../../../../shared/types';

interface AddBlocksParams {
  blocks: Array<{
    _type: string;
    _parent?: string | null;
    _name?: string;
    // Standard block props
    content?: string;
    styles?: string;
    tag?: string;
    level?: number;
    src?: string;
    alt?: string;
    href?: string;
    target?: string;
    variant?: string;
    size?: string;
    icon?: string;
    iconPosition?: string;
    name?: string; // For Icon blocks
    placeholder?: string;
    type?: string; // For Input blocks
    label?: string;
    backgroundImage?: string;
    // AIComponent props
    code?: string;
    componentName?: string;
  }>;
  insertAfterBlockId?: string;
}

/**
 * AddBlocks invocation - adds blocks to the project
 */
class AddBlocksInvocation implements ToolInvocation<AddBlocksParams> {
  constructor(public params: AddBlocksParams) {}

  async execute(context: ToolContext): Promise<ToolResult> {
    const { blocks, insertAfterBlockId } = this.params;
    const { projectId } = context;

    // Validate AIComponent blocks
    for (const block of blocks) {
      if (block._type === 'AIComponent' && block.code && block.componentName) {
        const validationError = validateComponent(block.code, block.componentName);
        if (validationError) {
          return {
            success: false,
            error: `Validation failed for AIComponent "${block.componentName}": ${validationError}`,
          };
        }
      }
    }

    // Create blocks with generated IDs
    const newBlocks: Block[] = blocks.map((block) => {
      const baseBlock = {
        _id: uuidv4(),
        _type: block._type,
        _parent: block._parent ?? null,
        _name: block._name,
      };

      // Build the full block based on type
      switch (block._type) {
        case 'Box':
          return {
            ...baseBlock,
            _type: 'Box' as const,
            tag: block.tag as 'div' | 'section' | 'header' | 'footer' | 'article' | 'aside' | 'main' | 'nav',
            styles: block.styles,
            backgroundImage: block.backgroundImage,
          };
        case 'Text':
          return {
            ...baseBlock,
            _type: 'Text' as const,
            content: block.content ?? '',
            tag: block.tag as 'p' | 'span',
            styles: block.styles,
          };
        case 'Heading':
          return {
            ...baseBlock,
            _type: 'Heading' as const,
            content: block.content ?? '',
            level: (block.level ?? 1) as 1 | 2 | 3 | 4 | 5 | 6,
            styles: block.styles,
          };
        case 'Button':
          return {
            ...baseBlock,
            _type: 'Button' as const,
            content: block.content ?? '',
            variant: block.variant as 'default' | 'outline' | 'ghost' | 'destructive',
            size: block.size as 'sm' | 'default' | 'lg',
            styles: block.styles,
            icon: block.icon,
            iconPosition: block.iconPosition as 'left' | 'right',
          };
        case 'Image':
          return {
            ...baseBlock,
            _type: 'Image' as const,
            src: block.src ?? '',
            alt: block.alt ?? '',
            styles: block.styles,
          };
        case 'Link':
          return {
            ...baseBlock,
            _type: 'Link' as const,
            content: block.content ?? '',
            href: block.href ?? '#',
            target: block.target as '_self' | '_blank',
            styles: block.styles,
          };
        case 'Icon':
          return {
            ...baseBlock,
            _type: 'Icon' as const,
            name: block.name ?? 'Star',
            size: block.size ? parseInt(block.size) : undefined,
            styles: block.styles,
          };
        case 'Input':
          return {
            ...baseBlock,
            _type: 'Input' as const,
            placeholder: block.placeholder,
            type: block.type as 'text' | 'email' | 'password' | 'number',
            label: block.label,
            styles: block.styles,
          };
        case 'AIComponent':
          return {
            ...baseBlock,
            _type: 'AIComponent' as const,
            code: block.code ?? '',
            componentName: block.componentName ?? 'UnnamedComponent',
          } as AIComponentBlock;
        default:
          // Default to Box for unknown types
          return {
            ...baseBlock,
            _type: 'Box' as const,
            styles: block.styles,
          };
      }
    });

    // Determine parent and position
    let parentId: string | null = null;
    let insertIndex: number | undefined;

    if (insertAfterBlockId) {
      const existingBlocks = await projectService.getBlocks(projectId);
      const targetBlock = existingBlocks.blocks.find(b => b._id === insertAfterBlockId);
      if (targetBlock) {
        parentId = targetBlock._parent;
        const siblings = existingBlocks.blocks.filter(b => b._parent === parentId);
        const targetIndex = siblings.findIndex(b => b._id === insertAfterBlockId);
        insertIndex = targetIndex + 1;
      }
    }

    // Add blocks to project
    await projectService.addBlocks(projectId, newBlocks, parentId, insertIndex);

    // Build output
    const blockSummary = newBlocks.map(b => `${b._type}${b._name ? ` "${b._name}"` : ''} (${b._id})`).join(', ');

    return {
      success: true,
      output: `Added ${newBlocks.length} block(s): ${blockSummary}`,
      blocksUpdate: newBlocks,
    };
  }
}

/**
 * AddBlocks Tool - adds one or more blocks to the project
 */
export class AddBlocksTool implements BaseTool {
  name = 'add_blocks';
  description = `Add one or more blocks to the page.

Blocks are the building blocks of the page. Each block has a type and properties.
Use Box blocks as containers to create layouts with nested children.

Block types:
- Box: Container element (div, section, header, etc.) - can have children
- Text: Paragraph or span text
- Heading: H1-H6 headings
- Button: Interactive button with variants
- Image: Image with src and alt
- Link: Hyperlink
- Icon: Lucide icon
- Input: Form input
- AIComponent: Custom React component with full code (use for complex interactive elements)

Example - Create a hero section:
add_blocks({
  blocks: [
    { _type: "Box", _name: "Hero Section", styles: "py-20 bg-gradient-to-b from-slate-900 to-slate-800" },
    { _type: "Heading", _name: "Hero Title", _parent: "<hero-box-id>", content: "Build faster", level: 1, styles: "text-5xl font-bold text-white" },
    { _type: "Text", _parent: "<hero-box-id>", content: "Create beautiful pages in minutes", styles: "text-xl text-gray-300" },
    { _type: "Button", _parent: "<hero-box-id>", content: "Get Started", variant: "default", styles: "mt-4" }
  ]
})`;

  schema: ToolSchema = makeToolSchema(
    this.name,
    this.description,
    {
      blocks: {
        type: 'array',
        description: 'Array of blocks to add',
        items: {
          type: 'object',
          properties: {
            _type: {
              type: 'string',
              enum: ['Box', 'Text', 'Heading', 'Button', 'Image', 'Link', 'Icon', 'Input', 'AIComponent'],
              description: 'Block type',
            },
            _parent: {
              type: 'string',
              description: 'Parent block ID for nesting. Use null for root-level blocks.',
            },
            _name: {
              type: 'string',
              description: 'Display name in the outline tree',
            },
            content: {
              type: 'string',
              description: 'Text content (for Text, Heading, Button, Link)',
            },
            styles: {
              type: 'string',
              description: 'Tailwind CSS classes',
            },
            tag: {
              type: 'string',
              description: 'HTML tag (for Box: div/section/header/etc, for Text: p/span)',
            },
            level: {
              type: 'number',
              description: 'Heading level 1-6 (for Heading blocks)',
            },
            src: {
              type: 'string',
              description: 'Image source URL (for Image blocks)',
            },
            alt: {
              type: 'string',
              description: 'Image alt text (for Image blocks)',
            },
            href: {
              type: 'string',
              description: 'Link URL (for Link blocks)',
            },
            target: {
              type: 'string',
              enum: ['_self', '_blank'],
              description: 'Link target (for Link blocks)',
            },
            variant: {
              type: 'string',
              enum: ['default', 'outline', 'ghost', 'destructive'],
              description: 'Button variant',
            },
            size: {
              type: 'string',
              enum: ['sm', 'default', 'lg'],
              description: 'Button/Icon size',
            },
            icon: {
              type: 'string',
              description: 'Lucide icon name (for Button with icon)',
            },
            iconPosition: {
              type: 'string',
              enum: ['left', 'right'],
              description: 'Icon position in button',
            },
            name: {
              type: 'string',
              description: 'Icon name (for Icon blocks)',
            },
            placeholder: {
              type: 'string',
              description: 'Input placeholder text',
            },
            type: {
              type: 'string',
              enum: ['text', 'email', 'password', 'number'],
              description: 'Input type',
            },
            label: {
              type: 'string',
              description: 'Input label',
            },
            backgroundImage: {
              type: 'string',
              description: 'Background image URL (for Box blocks)',
            },
            code: {
              type: 'string',
              description: 'React component code (for AIComponent blocks)',
            },
            componentName: {
              type: 'string',
              description: 'Component function name (for AIComponent blocks)',
            },
          },
          required: ['_type'],
        },
      },
      insertAfterBlockId: {
        type: 'string',
        description: 'Insert new blocks after this block ID. If not specified, adds to the end.',
      },
    },
    ['blocks']
  );

  build(params: unknown): ToolInvocation<AddBlocksParams> {
    const p = params as AddBlocksParams;
    return new AddBlocksInvocation({
      blocks: p.blocks,
      insertAfterBlockId: p.insertAfterBlockId,
    });
  }
}
