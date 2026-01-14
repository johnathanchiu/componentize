/**
 * PropertiesPanel - Edit properties of selected block
 */
import React from 'react';
import { useAtomValue } from 'jotai';
import { Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { selectedBlockAtom, selectedBlockIdsAtom } from '@/atoms';
import { useBlocksUndoableActions } from '@/atoms/history';
import type { Block } from '../../../../shared/types';

/**
 * Property editor for a specific block type
 */
const BlockPropertyEditor: React.FC<{ block: Block }> = ({ block }) => {
  const { updateBlocks, removeBlocks, duplicateBlocks } = useBlocksUndoableActions();

  const handleUpdate = (updates: Partial<Block>) => {
    updateBlocks([{ _id: block._id, ...updates }]);
  };

  const handleDelete = () => {
    removeBlocks([block]);
  };

  const handleDuplicate = () => {
    duplicateBlocks([block._id]);
  };

  // Common fields for all blocks
  const commonFields = (
    <div className="space-y-3">
      <div>
        <Label htmlFor="block-name" className="text-xs">Name</Label>
        <Input
          id="block-name"
          value={block._name || ''}
          onChange={(e) => handleUpdate({ _name: e.target.value })}
          placeholder="Block name"
          className="h-8 text-sm"
        />
      </div>
    </div>
  );

  // Type-specific fields
  const typeFields = () => {
    switch (block._type) {
      case 'Box':
        return (
          <>
            <div>
              <Label htmlFor="box-tag" className="text-xs">Tag</Label>
              <Select
                value={block.tag || 'div'}
                onValueChange={(value) => handleUpdate({ tag: value as typeof block.tag })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="div">div</SelectItem>
                  <SelectItem value="section">section</SelectItem>
                  <SelectItem value="header">header</SelectItem>
                  <SelectItem value="footer">footer</SelectItem>
                  <SelectItem value="main">main</SelectItem>
                  <SelectItem value="nav">nav</SelectItem>
                  <SelectItem value="article">article</SelectItem>
                  <SelectItem value="aside">aside</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="box-styles" className="text-xs">Styles (Tailwind)</Label>
              <Textarea
                id="box-styles"
                value={block.styles || ''}
                onChange={(e) => handleUpdate({ styles: e.target.value })}
                placeholder="p-4 bg-white rounded"
                className="text-sm font-mono min-h-[60px]"
              />
            </div>
          </>
        );

      case 'Text':
        return (
          <>
            <div>
              <Label htmlFor="text-content" className="text-xs">Content</Label>
              <Textarea
                id="text-content"
                value={block.content}
                onChange={(e) => handleUpdate({ content: e.target.value })}
                className="text-sm min-h-[80px]"
              />
            </div>
            <div>
              <Label htmlFor="text-styles" className="text-xs">Styles</Label>
              <Input
                id="text-styles"
                value={block.styles || ''}
                onChange={(e) => handleUpdate({ styles: e.target.value })}
                className="h-8 text-sm font-mono"
              />
            </div>
          </>
        );

      case 'Heading':
        return (
          <>
            <div>
              <Label htmlFor="heading-content" className="text-xs">Content</Label>
              <Input
                id="heading-content"
                value={block.content}
                onChange={(e) => handleUpdate({ content: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="heading-level" className="text-xs">Level</Label>
              <Select
                value={String(block.level)}
                onValueChange={(value) => handleUpdate({ level: Number(value) as typeof block.level })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>H{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="heading-styles" className="text-xs">Styles</Label>
              <Input
                id="heading-styles"
                value={block.styles || ''}
                onChange={(e) => handleUpdate({ styles: e.target.value })}
                className="h-8 text-sm font-mono"
              />
            </div>
          </>
        );

      case 'Button':
        return (
          <>
            <div>
              <Label htmlFor="button-content" className="text-xs">Label</Label>
              <Input
                id="button-content"
                value={block.content}
                onChange={(e) => handleUpdate({ content: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="button-variant" className="text-xs">Variant</Label>
              <Select
                value={block.variant || 'default'}
                onValueChange={(value) => handleUpdate({ variant: value as typeof block.variant })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                  <SelectItem value="ghost">Ghost</SelectItem>
                  <SelectItem value="destructive">Destructive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="button-size" className="text-xs">Size</Label>
              <Select
                value={block.size || 'default'}
                onValueChange={(value) => handleUpdate({ size: value as typeof block.size })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case 'Image':
        return (
          <>
            <div>
              <Label htmlFor="image-src" className="text-xs">Source URL</Label>
              <Input
                id="image-src"
                value={block.src}
                onChange={(e) => handleUpdate({ src: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="image-alt" className="text-xs">Alt Text</Label>
              <Input
                id="image-alt"
                value={block.alt}
                onChange={(e) => handleUpdate({ alt: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="image-styles" className="text-xs">Styles</Label>
              <Input
                id="image-styles"
                value={block.styles || ''}
                onChange={(e) => handleUpdate({ styles: e.target.value })}
                className="h-8 text-sm font-mono"
              />
            </div>
          </>
        );

      case 'Link':
        return (
          <>
            <div>
              <Label htmlFor="link-content" className="text-xs">Text</Label>
              <Input
                id="link-content"
                value={block.content}
                onChange={(e) => handleUpdate({ content: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="link-href" className="text-xs">URL</Label>
              <Input
                id="link-href"
                value={block.href}
                onChange={(e) => handleUpdate({ href: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="link-target" className="text-xs">Target</Label>
              <Select
                value={block.target || '_self'}
                onValueChange={(value) => handleUpdate({ target: value as typeof block.target })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_self">Same window</SelectItem>
                  <SelectItem value="_blank">New tab</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case 'Input':
        return (
          <>
            <div>
              <Label htmlFor="input-placeholder" className="text-xs">Placeholder</Label>
              <Input
                id="input-placeholder"
                value={block.placeholder || ''}
                onChange={(e) => handleUpdate({ placeholder: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="input-type" className="text-xs">Type</Label>
              <Select
                value={block.type || 'text'}
                onValueChange={(value) => handleUpdate({ type: value as typeof block.type })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="password">Password</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="input-label" className="text-xs">Label</Label>
              <Input
                id="input-label"
                value={block.label || ''}
                onChange={(e) => handleUpdate({ label: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </>
        );

      case 'AIComponent':
        return (
          <>
            <div>
              <Label htmlFor="ai-name" className="text-xs">Component Name</Label>
              <Input
                id="ai-name"
                value={block.componentName}
                onChange={(e) => handleUpdate({ componentName: e.target.value })}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div>
              <Label htmlFor="ai-code" className="text-xs">Code</Label>
              <Textarea
                id="ai-code"
                value={block.code}
                onChange={(e) => handleUpdate({ code: e.target.value })}
                className="text-sm font-mono min-h-[200px]"
                spellCheck={false}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Block type header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase">
          {block._type}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDuplicate}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Common fields */}
      {commonFields}

      {/* Type-specific fields */}
      {typeFields()}
    </div>
  );
};

export const PropertiesPanel: React.FC = () => {
  const selectedBlock = useAtomValue(selectedBlockAtom);
  const selectedIds = useAtomValue(selectedBlockIdsAtom);

  if (selectedIds.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        Select a block to edit its properties
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        {selectedIds.length} blocks selected
        <br />
        <span className="text-xs">Select a single block to edit</span>
      </div>
    );
  }

  if (!selectedBlock) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        Block not found
      </div>
    );
  }

  return (
    <div className="p-3">
      <BlockPropertyEditor block={selectedBlock} />
    </div>
  );
};

export default PropertiesPanel;
