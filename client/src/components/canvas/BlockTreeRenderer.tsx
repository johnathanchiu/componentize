/**
 * BlockTreeRenderer - Recursively renders blocks with their children
 */
import React from 'react';
import type { Block } from '../../../../shared/types';
import { BlockRenderer } from '../blocks';

interface BlockTreeRendererProps {
  blocks: Block[];
  parentId?: string | null;
  selectedIds?: string[];
  onBlockClick?: (blockId: string, e: React.MouseEvent) => void;
}

/**
 * Recursively render blocks and their children
 */
export const BlockTreeRenderer: React.FC<BlockTreeRendererProps> = ({
  blocks,
  parentId = null,
  selectedIds = [],
  onBlockClick,
}) => {
  // Get blocks at this level (children of parentId)
  const levelBlocks = blocks.filter((block) => block._parent === parentId);

  if (levelBlocks.length === 0) {
    return null;
  }

  return (
    <>
      {levelBlocks.map((block) => {
        const isSelected = selectedIds.includes(block._id);
        const hasChildren = blocks.some((b) => b._parent === block._id);

        return (
          <BlockRenderer
            key={block._id}
            block={block}
            isSelected={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              onBlockClick?.(block._id, e);
            }}
          >
            {hasChildren && (
              <BlockTreeRenderer
                blocks={blocks}
                parentId={block._id}
                selectedIds={selectedIds}
                onBlockClick={onBlockClick}
              />
            )}
          </BlockRenderer>
        );
      })}
    </>
  );
};

export default BlockTreeRenderer;
