/**
 * BlockTreeRenderer - Renders blocks in two modes:
 * 1. Positioned blocks (have _position) - rendered with absolute positioning
 * 2. Flow blocks (no _position) - rendered in normal document flow
 *
 * Supports drag-to-move for positioned blocks
 */
import React, { useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import type { Block } from '../../../../shared/types';
import { BlockRenderer } from '../blocks';
import { blocksAtom, canvasViewportGetterAtom } from '../../atoms';

interface BlockTreeRendererProps {
  blocks: Block[];
  parentId?: string | null;
  selectedIds?: string[];
  onBlockClick?: (blockId: string, e: React.MouseEvent) => void;
}

/**
 * Render blocks - handles both positioned and flow layouts
 */
export const BlockTreeRenderer: React.FC<BlockTreeRendererProps> = ({
  blocks,
  parentId = null,
  selectedIds = [],
  onBlockClick,
}) => {
  const [, setAllBlocks] = useAtom(blocksAtom);
  const getViewport = useAtomValue(canvasViewportGetterAtom);

  // Get blocks at this level (children of parentId)
  const levelBlocks = blocks.filter((block) => block._parent === parentId);

  // Split into positioned and flow blocks (only at root level)
  const positionedBlocks = parentId === null
    ? levelBlocks.filter((block) => block._position != null)
    : [];
  const flowBlocks = parentId === null
    ? levelBlocks.filter((block) => block._position == null)
    : levelBlocks;

  // Drag state for position-based movement
  const [dragState, setDragState] = React.useState<{
    blockId: string;
    startMouseX: number;
    startMouseY: number;
    startBlockX: number;
    startBlockY: number;
  } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, block: Block) => {
    // Only start drag on positioned blocks
    if (!block._position) return;

    e.preventDefault();
    e.stopPropagation();

    setDragState({
      blockId: block._id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startBlockX: block._position.x,
      startBlockY: block._position.y,
    });
  }, []);

  // Attach global mouse listeners when dragging
  // Gets current zoom from viewport getter to scale mouse movement correctly
  React.useEffect(() => {
    if (!dragState) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Get current zoom from getter (avoids stale closure during pan/zoom)
      const zoom = getViewport?.()?.zoom ?? 1;

      // Calculate delta in screen space, then convert to canvas space
      const deltaX = (e.clientX - dragState.startMouseX) / zoom;
      const deltaY = (e.clientY - dragState.startMouseY) / zoom;

      const newX = dragState.startBlockX + deltaX;
      const newY = dragState.startBlockY + deltaY;

      setAllBlocks(prev => prev.map(b =>
        b._id === dragState.blockId
          ? { ...b, _position: { x: newX, y: newY } }
          : b
      ));
    };

    const handleGlobalMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, setAllBlocks, getViewport]);

  /**
   * Render children of a block (always flow layout inside containers)
   */
  const renderChildren = (block: Block) => {
    const hasChildren = blocks.some((b) => b._parent === block._id);
    if (!hasChildren) return null;

    return (
      <BlockTreeRenderer
        blocks={blocks}
        parentId={block._id}
        selectedIds={selectedIds}
        onBlockClick={onBlockClick}
      />
    );
  };

  /**
   * Render a single block with wrapper
   */
  const renderBlock = (block: Block, isPositioned: boolean) => {
    const isSelected = selectedIds.includes(block._id);
    const isDragging = dragState?.blockId === block._id;

    return (
      <div
        key={block._id}
        onMouseDown={isPositioned ? (e) => handleMouseDown(e, block) : undefined}
        className={isDragging ? 'cursor-grabbing' : isPositioned ? 'cursor-grab' : ''}
        style={isPositioned && block._position ? {
          position: 'absolute',
          left: block._position.x,
          top: block._position.y,
          width: block._size?.width,
          height: block._size?.height,
          zIndex: isDragging ? 1000 : undefined,
        } : undefined}
      >
        <BlockRenderer
          block={block}
          isSelected={isSelected}
          onClick={(e) => {
            e.stopPropagation();
            onBlockClick?.(block._id, e);
          }}
        >
          {renderChildren(block)}
        </BlockRenderer>
      </div>
    );
  };

  if (levelBlocks.length === 0) {
    return null;
  }

  // At root level, render both positioned and flow blocks
  if (parentId === null) {
    return (
      <>
        {/* Positioned blocks - absolute positioning */}
        {positionedBlocks.map((block) => renderBlock(block, true))}

        {/* Flow blocks - normal document flow */}
        {flowBlocks.map((block) => renderBlock(block, false))}
      </>
    );
  }

  // Nested blocks always use flow layout
  return (
    <>
      {flowBlocks.map((block) => renderBlock(block, false))}
    </>
  );
};

export default BlockTreeRenderer;
