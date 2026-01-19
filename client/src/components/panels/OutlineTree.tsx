/**
 * OutlineTree - Hierarchical tree view of blocks with drag-to-reorder
 * Uses react-arborist for virtualized tree rendering
 */
import React, { useMemo, useCallback } from 'react';
import { Tree } from 'react-arborist';
import type { NodeRendererProps, CursorProps } from 'react-arborist';
import { useAtom, useAtomValue } from 'jotai';
import { Box, Type, Heading1, MousePointer2, Image, Link, Sparkles, FormInput, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { blocksAtom, selectedBlockIdsAtom } from '@/atoms';
import { useBlocksUndoableActions } from '@/atoms/history';
import type { Block } from '../../../../shared/types';

// Block type icons
const BLOCK_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Box: Box,
  Text: Type,
  Heading: Heading1,
  Button: MousePointer2,
  Image: Image,
  Link: Link,
  Icon: Sparkles,
  Input: FormInput,
  AIComponent: Sparkles,
};

// Tree node with children
interface TreeNode {
  _id: string;
  _type: string;
  _name?: string;
  _parent: string | null;
  children: TreeNode[];
}

/**
 * Convert flat blocks array to hierarchical tree
 */
function blocksToTree(blocks: Block[]): TreeNode[] {
  const idMap: Record<string, TreeNode> = {};

  // Create tree nodes for all blocks
  blocks.forEach((block) => {
    idMap[block._id] = {
      _id: block._id,
      _type: block._type,
      _name: block._name,
      _parent: block._parent,
      children: [],
    };
  });

  // Build tree structure
  const rootNodes: TreeNode[] = [];
  blocks.forEach((block) => {
    if (block._parent && idMap[block._parent]) {
      idMap[block._parent].children.push(idMap[block._id]);
    } else {
      rootNodes.push(idMap[block._id]);
    }
  });

  return rootNodes;
}

/**
 * Custom cursor for drop indicator
 */
const DropCursor: React.FC<CursorProps> = ({ top, left }) => (
  <div
    className="absolute z-50 pointer-events-none"
    style={{ top: `${top - 1}px`, left: `${left}px`, right: '8px' }}
  >
    <div className="h-0.5 bg-blue-500 rounded-full" />
  </div>
);

/**
 * Custom node renderer
 */
const TreeNodeRenderer: React.FC<NodeRendererProps<TreeNode>> = ({
  node,
  style,
  dragHandle,
}) => {
  const Icon = BLOCK_ICONS[node.data._type] || Box;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        'flex items-center gap-1 py-0.5 px-2 rounded cursor-pointer text-sm group',
        'hover:bg-gray-100',
        node.isSelected && 'bg-blue-100 text-blue-800',
        node.willReceiveDrop && 'bg-blue-50 ring-1 ring-blue-300',
        node.state.isDragging && 'opacity-50'
      )}
      onClick={() => node.isInternal && node.toggle()}
    >
      {/* Drag handle */}
      <GripVertical className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab" />

      {/* Expand/collapse toggle */}
      <button
        className={cn(
          'p-0.5 rounded hover:bg-gray-200',
          !hasChildren && 'invisible'
        )}
        onClick={(e) => {
          e.stopPropagation();
          node.toggle();
        }}
      >
        {node.isOpen ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>

      {/* Block icon */}
      <Icon className="h-3.5 w-3.5 text-gray-500 shrink-0" />

      {/* Block name */}
      <span className="truncate flex-1">
        {node.data._name || node.data._type}
      </span>
    </div>
  );
};

export const OutlineTree: React.FC = () => {
  const blocks = useAtomValue(blocksAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedBlockIdsAtom);
  const { moveBlocks } = useBlocksUndoableActions();

  // Convert flat blocks to tree structure
  const treeData = useMemo(() => blocksToTree(blocks), [blocks]);

  // Handle selection
  const handleSelect = useCallback(
    (nodes: { id: string }[]) => {
      const ids = nodes.map((n) => n.id);
      setSelectedIds(ids);
    },
    [setSelectedIds]
  );

  // Handle move (drag and drop)
  const handleMove = useCallback(
    ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
      // Move each block to new position
      dragIds.forEach((id) => {
        moveBlocks([id], parentId, index);
      });
    },
    [moveBlocks]
  );

  if (blocks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        No blocks yet
      </div>
    );
  }

  return (
    <div className="p-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
        Outline
      </h3>
      <Tree
        data={treeData}
        idAccessor="_id"
        childrenAccessor="children"
        openByDefault={true}
        width="100%"
        height={400}
        rowHeight={28}
        indent={16}
        selection={selectedIds[0] || undefined}
        onSelect={handleSelect}
        onMove={handleMove}
        renderCursor={DropCursor}
      >
        {TreeNodeRenderer}
      </Tree>
    </div>
  );
};

export default OutlineTree;
