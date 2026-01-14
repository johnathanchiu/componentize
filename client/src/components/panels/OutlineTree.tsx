/**
 * OutlineTree - Hierarchical tree view of blocks
 */
import React, { useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { ChevronRight, ChevronDown, Box, Type, Heading1, MousePointer2, Image, Link, Sparkles, FormInput, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { blocksAtom, selectedBlockIdsAtom } from '@/atoms';
import type { Block } from '../../../../shared/types';

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

interface TreeNodeProps {
  block: Block;
  blocks: Block[];
  level: number;
  selectedIds: string[];
  onSelect: (id: string, e: React.MouseEvent) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ block, blocks, level, selectedIds, onSelect }) => {
  const [expanded, setExpanded] = useState(true);
  const children = blocks.filter((b) => b._parent === block._id);
  const hasChildren = children.length > 0;
  const isSelected = selectedIds.includes(block._id);
  const Icon = BLOCK_ICONS[block._type] || Box;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-sm',
          'hover:bg-gray-100',
          isSelected && 'bg-blue-100 text-blue-800'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={(e) => onSelect(block._id, e)}
      >
        {/* Expand/collapse toggle */}
        <button
          className={cn(
            'p-0.5 rounded hover:bg-gray-200',
            !hasChildren && 'invisible'
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {/* Block icon */}
        <Icon className="h-3.5 w-3.5 text-gray-500" />

        {/* Block name */}
        <span className="truncate flex-1">
          {block._name || block._type}
        </span>

        {/* Drag handle (visual only for now) */}
        <GripVertical className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child._id}
              block={child}
              blocks={blocks}
              level={level + 1}
              selectedIds={selectedIds}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const OutlineTree: React.FC = () => {
  const blocks = useAtomValue(blocksAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedBlockIdsAtom);

  const rootBlocks = blocks.filter((b) => b._parent === null);

  const handleSelect = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey) {
      // Multi-select
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else {
      // Single select
      setSelectedIds([id]);
    }
  };

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
      <div className="space-y-0.5">
        {rootBlocks.map((block) => (
          <TreeNode
            key={block._id}
            block={block}
            blocks={blocks}
            level={0}
            selectedIds={selectedIds}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default OutlineTree;
