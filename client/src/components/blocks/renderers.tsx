/**
 * Block Renderers - React components for each block type
 * Standard blocks are rendered directly, AIComponent uses runtime compilation
 */
import React from 'react';
import type {
  Block,
  BoxBlock,
  TextBlock,
  HeadingBlock,
  ButtonBlock,
  ImageBlock,
  LinkBlock,
  IconBlock,
  InputBlock,
  AIComponentBlock,
} from '../../../../shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as LucideIcons from 'lucide-react';

// ============================================================================
// Renderer Props
// ============================================================================

export interface BlockRendererProps {
  block: Block;
  children?: React.ReactNode;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

// ============================================================================
// Standard Block Renderers
// ============================================================================

export const BoxRenderer: React.FC<BlockRendererProps & { block: BoxBlock }> = ({
  block,
  children,
  isSelected,
  onClick,
}) => {
  const Tag = block.tag || 'div';
  return React.createElement(
    Tag,
    {
      className: `${block.styles || ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}`.trim(),
      onClick,
      style: block.backgroundImage ? { backgroundImage: `url(${block.backgroundImage})` } : undefined,
    },
    children
  );
};

export const TextRenderer: React.FC<BlockRendererProps & { block: TextBlock }> = ({
  block,
  isSelected,
  onClick,
}) => {
  const Tag = block.tag || 'p';
  return React.createElement(
    Tag,
    {
      className: `${block.styles || ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}`.trim(),
      onClick,
    },
    block.content
  );
};

export const HeadingRenderer: React.FC<BlockRendererProps & { block: HeadingBlock }> = ({
  block,
  isSelected,
  onClick,
}) => {
  const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
  return React.createElement(
    Tag,
    {
      className: `${block.styles || ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}`.trim(),
      onClick,
    },
    block.content
  );
};

export const ButtonRenderer: React.FC<BlockRendererProps & { block: ButtonBlock }> = ({
  block,
  isSelected,
  onClick,
}) => {
  const IconComponent = block.icon ? (LucideIcons as Record<string, React.FC<{ className?: string }>>)[block.icon] : null;

  return (
    <Button
      variant={block.variant || 'default'}
      size={block.size || 'default'}
      className={`${block.styles || ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}`.trim()}
      onClick={onClick}
    >
      {block.iconPosition === 'left' && IconComponent && <IconComponent className="mr-2 h-4 w-4" />}
      {block.content}
      {block.iconPosition === 'right' && IconComponent && <IconComponent className="ml-2 h-4 w-4" />}
    </Button>
  );
};

export const ImageRenderer: React.FC<BlockRendererProps & { block: ImageBlock }> = ({
  block,
  isSelected,
  onClick,
}) => {
  return (
    <img
      src={block.src}
      alt={block.alt}
      className={`${block.styles || ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}`.trim()}
      onClick={onClick}
    />
  );
};

export const LinkRenderer: React.FC<BlockRendererProps & { block: LinkBlock }> = ({
  block,
  isSelected,
  onClick,
}) => {
  return (
    <a
      href={block.href}
      target={block.target || '_self'}
      className={`${block.styles || ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}`.trim()}
      onClick={(e) => {
        e.preventDefault(); // Prevent navigation in editor
        onClick?.(e);
      }}
    >
      {block.content}
    </a>
  );
};

export const IconRenderer: React.FC<BlockRendererProps & { block: IconBlock }> = ({
  block,
  isSelected,
  onClick,
}) => {
  const IconComponent = (LucideIcons as Record<string, React.FC<{ className?: string; size?: number }>>)[block.name];

  if (!IconComponent) {
    return (
      <span
        className={`${block.styles || ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}`.trim()}
        onClick={onClick}
      >
        [Icon: {block.name}]
      </span>
    );
  }

  return (
    <span
      className={`inline-flex ${block.styles || ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}`.trim()}
      onClick={onClick}
    >
      <IconComponent size={block.size || 24} />
    </span>
  );
};

export const InputRenderer: React.FC<BlockRendererProps & { block: InputBlock }> = ({
  block,
  isSelected,
  onClick,
}) => {
  return (
    <div
      className={`${isSelected ? 'ring-2 ring-blue-500' : ''}`.trim()}
      onClick={onClick}
    >
      {block.label && (
        <label className="block text-sm font-medium mb-1">{block.label}</label>
      )}
      <Input
        type={block.type || 'text'}
        placeholder={block.placeholder}
        className={block.styles}
        readOnly // Inputs are read-only in the editor
      />
    </div>
  );
};

// ============================================================================
// Block Renderer Registry
// ============================================================================

export const blockRenderers: Record<string, React.FC<BlockRendererProps>> = {
  Box: BoxRenderer as React.FC<BlockRendererProps>,
  Text: TextRenderer as React.FC<BlockRendererProps>,
  Heading: HeadingRenderer as React.FC<BlockRendererProps>,
  Button: ButtonRenderer as React.FC<BlockRendererProps>,
  Image: ImageRenderer as React.FC<BlockRendererProps>,
  Link: LinkRenderer as React.FC<BlockRendererProps>,
  Icon: IconRenderer as React.FC<BlockRendererProps>,
  Input: InputRenderer as React.FC<BlockRendererProps>,
  // AIComponent is handled separately
};

// ============================================================================
// Universal Block Renderer
// ============================================================================

// Import AIComponent renderer (dynamic to avoid circular deps)
import { AIComponentRenderer } from './AIComponentRenderer';

export const BlockRenderer: React.FC<BlockRendererProps> = (props) => {
  const { block, children } = props;

  // Handle AIComponent specially
  if (block._type === 'AIComponent') {
    return (
      <AIComponentRenderer
        block={block as AIComponentBlock}
        isSelected={props.isSelected}
        onClick={props.onClick}
      />
    );
  }

  const Renderer = blockRenderers[block._type];

  if (!Renderer) {
    // Unknown block type - render a placeholder
    return (
      <div className="p-4 border-2 border-dashed border-gray-300 rounded bg-gray-50">
        <span className="text-gray-500">Unknown block: {block._type}</span>
      </div>
    );
  }

  return <Renderer {...props}>{children}</Renderer>;
};
