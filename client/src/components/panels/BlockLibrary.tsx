/**
 * BlockLibrary - Panel for adding new blocks to the canvas
 * Uses native HTML5 Drag and Drop API
 */
import React from 'react';
import { useSetAtom } from 'jotai';
import { nanoid } from 'nanoid';
import {
  Box,
  Type,
  Heading1,
  MousePointer2,
  Image,
  Link,
  Sparkles,
  FormInput,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { blocksAtom, draggingBlockAtom } from '@/atoms';
import type { Block, BoxBlock, TextBlock, HeadingBlock, ButtonBlock, ImageBlock, LinkBlock, InputBlock, AIComponentBlock } from '../../../../shared/types';

interface BlockTypeConfig {
  type: Block['_type'];
  label: string;
  icon: React.FC<{ className?: string }>;
  category: 'layout' | 'typography' | 'interactive' | 'media' | 'ai';
  createBlock: () => Block;
}

const BLOCK_TYPES: BlockTypeConfig[] = [
  // Layout
  {
    type: 'Box',
    label: 'Box',
    icon: Box,
    category: 'layout',
    createBlock: (): BoxBlock => ({
      _id: nanoid(),
      _type: 'Box',
      _parent: null,
      _name: 'Box',
      tag: 'div',
      styles: 'p-4 border border-gray-200 rounded',
    }),
  },
  // Typography
  {
    type: 'Heading',
    label: 'Heading',
    icon: Heading1,
    category: 'typography',
    createBlock: (): HeadingBlock => ({
      _id: nanoid(),
      _type: 'Heading',
      _parent: null,
      _name: 'Heading',
      level: 2,
      content: 'Heading',
      styles: 'text-2xl font-bold',
    }),
  },
  {
    type: 'Text',
    label: 'Text',
    icon: Type,
    category: 'typography',
    createBlock: (): TextBlock => ({
      _id: nanoid(),
      _type: 'Text',
      _parent: null,
      _name: 'Text',
      tag: 'p',
      content: 'Text paragraph',
      styles: 'text-base text-gray-700',
    }),
  },
  // Interactive
  {
    type: 'Button',
    label: 'Button',
    icon: MousePointer2,
    category: 'interactive',
    createBlock: (): ButtonBlock => ({
      _id: nanoid(),
      _type: 'Button',
      _parent: null,
      _name: 'Button',
      content: 'Button',
      variant: 'default',
      size: 'default',
    }),
  },
  {
    type: 'Input',
    label: 'Input',
    icon: FormInput,
    category: 'interactive',
    createBlock: (): InputBlock => ({
      _id: nanoid(),
      _type: 'Input',
      _parent: null,
      _name: 'Input',
      placeholder: 'Enter text...',
      type: 'text',
    }),
  },
  {
    type: 'Link',
    label: 'Link',
    icon: Link,
    category: 'interactive',
    createBlock: (): LinkBlock => ({
      _id: nanoid(),
      _type: 'Link',
      _parent: null,
      _name: 'Link',
      content: 'Link text',
      href: '#',
    }),
  },
  // Media
  {
    type: 'Image',
    label: 'Image',
    icon: Image,
    category: 'media',
    createBlock: (): ImageBlock => ({
      _id: nanoid(),
      _type: 'Image',
      _parent: null,
      _name: 'Image',
      src: 'https://via.placeholder.com/300x200',
      alt: 'Placeholder image',
      styles: 'rounded',
    }),
  },
  // AI
  {
    type: 'AIComponent',
    label: 'AI Component',
    icon: Sparkles,
    category: 'ai',
    createBlock: (): AIComponentBlock => ({
      _id: nanoid(),
      _type: 'AIComponent',
      _parent: null,
      _name: 'AI Component',
      componentName: 'CustomComponent',
      code: `function CustomComponent() {
  return (
    <Card className="p-4">
      <p>Edit this component's code</p>
    </Card>
  );
}`,
    }),
  },
];

const CATEGORIES = [
  { id: 'layout', label: 'Layout' },
  { id: 'typography', label: 'Typography' },
  { id: 'interactive', label: 'Interactive' },
  { id: 'media', label: 'Media' },
  { id: 'ai', label: 'AI' },
] as const;

/**
 * Draggable block item in the library
 * Uses native HTML5 Drag and Drop
 */
const DraggableBlockItem: React.FC<{ config: BlockTypeConfig }> = ({ config }) => {
  const setBlocks = useSetAtom(blocksAtom);
  const setDraggingBlock = useSetAtom(draggingBlockAtom);

  const handleDragStart = (e: React.DragEvent) => {
    // Set drag data for native DnD
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', config.type);

    // Store in Jotai atom for drop handler
    setDraggingBlock({
      type: config.label,
      createBlock: config.createBlock,
    });
  };

  const handleDragEnd = () => {
    setDraggingBlock(null);
  };

  const handleClick = () => {
    const newBlock = config.createBlock();
    setBlocks((prev) => [...prev, newBlock]);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className={cn(
        'h-auto py-2 px-3 flex flex-col items-center gap-1 text-xs',
        'border rounded-md bg-white hover:bg-gray-50 hover:border-gray-300',
        'cursor-grab active:cursor-grabbing select-none',
        'transition-all'
      )}
    >
      <config.icon className="h-4 w-4 text-gray-600" />
      <span className="text-gray-700">{config.label}</span>
    </div>
  );
};

export const BlockLibrary: React.FC = () => {
  return (
    <div className="p-3 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
        Add Blocks
      </h3>
      <p className="text-xs text-gray-400 px-1">
        Click or drag to canvas
      </p>

      {CATEGORIES.map((category) => {
        const blocks = BLOCK_TYPES.filter((b) => b.category === category.id);
        if (blocks.length === 0) return null;

        return (
          <div key={category.id} className="space-y-2">
            <h4 className="text-xs font-medium text-gray-400 px-1">{category.label}</h4>
            <div className="grid grid-cols-2 gap-2">
              {blocks.map((config) => (
                <DraggableBlockItem key={config.type} config={config} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BlockLibrary;
