/**
 * Block state atoms - Jotai-based state management for blocks
 * Inspired by chaibuilder's pattern
 */
import { atom } from 'jotai';
import { splitAtom } from 'jotai/utils';
import type { Block } from '../../../shared/types';

// ============================================================================
// Core Block Atoms
// ============================================================================

/**
 * Primary blocks array atom - stores all blocks in flat array
 */
export const blocksAtom = atom<Block[]>([]);
blocksAtom.debugLabel = 'blocksAtom';

/**
 * Split atom for efficient per-block updates
 * Each block gets its own atom, preventing unnecessary re-renders
 */
export const blockAtomsAtom = splitAtom(blocksAtom);
blockAtomsAtom.debugLabel = 'blockAtomsAtom';

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Root blocks - blocks with no parent (top-level)
 */
export const rootBlocksAtom = atom((get) => {
  const blocks = get(blocksAtom);
  return blocks.filter((block) => block._parent === null);
});
rootBlocksAtom.debugLabel = 'rootBlocksAtom';

/**
 * Block tree structure - converts flat array to tree for rendering
 */
export interface BlockTreeNode {
  block: Block;
  children: BlockTreeNode[];
}

export const blockTreeAtom = atom((get) => {
  const blocks = get(blocksAtom);

  const buildTree = (parentId: string | null): BlockTreeNode[] => {
    return blocks
      .filter((block) => block._parent === parentId)
      .map((block) => ({
        block,
        children: buildTree(block._id),
      }));
  };

  return buildTree(null);
});
blockTreeAtom.debugLabel = 'blockTreeAtom';

/**
 * Get children of a specific block
 */
export const getBlockChildrenAtom = atom((get) => {
  const blocks = get(blocksAtom);
  return (parentId: string) => blocks.filter((block) => block._parent === parentId);
});
getBlockChildrenAtom.debugLabel = 'getBlockChildrenAtom';

/**
 * Get a block by ID
 */
export const getBlockByIdAtom = atom((get) => {
  const blocks = get(blocksAtom);
  return (blockId: string) => blocks.find((block) => block._id === blockId);
});
getBlockByIdAtom.debugLabel = 'getBlockByIdAtom';

/**
 * Block count
 */
export const blockCountAtom = atom((get) => get(blocksAtom).length);
blockCountAtom.debugLabel = 'blockCountAtom';

// ============================================================================
// Block Operations (non-undoable, raw operations)
// ============================================================================

/**
 * Atom for setting blocks directly (used by undo/redo)
 */
export const setBlocksAtom = atom(
  null,
  (get, set, newBlocks: Block[]) => {
    set(blocksAtom, newBlocks);
  }
);

/**
 * Add blocks at a specific position
 */
export const addBlocksAtom = atom(
  null,
  (get, set, { blocks: newBlocks, parentId, position }: { blocks: Block[]; parentId?: string | null; position?: number }) => {
    const currentBlocks = get(blocksAtom);

    // Set parent for all new blocks if specified
    const blocksWithParent = newBlocks.map((block) => ({
      ...block,
      _parent: parentId ?? block._parent ?? null,
    }));

    if (position !== undefined) {
      // Insert at specific position among siblings
      const siblings = currentBlocks.filter((b) => b._parent === (parentId ?? null));
      const nonSiblings = currentBlocks.filter((b) => b._parent !== (parentId ?? null));
      const before = siblings.slice(0, position);
      const after = siblings.slice(position);
      set(blocksAtom, [...nonSiblings, ...before, ...blocksWithParent, ...after]);
    } else {
      set(blocksAtom, [...currentBlocks, ...blocksWithParent]);
    }
  }
);

/**
 * Remove blocks by IDs (also removes children recursively)
 */
export const removeBlocksAtom = atom(
  null,
  (get, set, blockIds: string[]) => {
    const currentBlocks = get(blocksAtom);

    // Collect all IDs to remove (including children)
    const idsToRemove = new Set<string>();
    const collectChildren = (ids: string[]) => {
      ids.forEach((id) => {
        idsToRemove.add(id);
        const children = currentBlocks.filter((b) => b._parent === id);
        collectChildren(children.map((c) => c._id));
      });
    };
    collectChildren(blockIds);

    set(blocksAtom, currentBlocks.filter((b) => !idsToRemove.has(b._id)));
  }
);

/**
 * Update block properties
 */
export const updateBlocksAtom = atom(
  null,
  (get, set, updates: Array<{ _id: string } & Partial<Block>>) => {
    const currentBlocks = get(blocksAtom);
    const updateMap = new Map(updates.map((u) => [u._id, u]));

    set(blocksAtom, currentBlocks.map((block) => {
      const update = updateMap.get(block._id);
      if (update) {
        return { ...block, ...update } as Block;
      }
      return block;
    }));
  }
);

/**
 * Move blocks to a new parent/position
 */
export const moveBlocksAtom = atom(
  null,
  (get, set, { blockIds, newParentId, position }: { blockIds: string[]; newParentId: string | null; position: number }) => {
    const currentBlocks = get(blocksAtom);

    // Remove blocks from current positions
    const blocksToMove = currentBlocks.filter((b) => blockIds.includes(b._id));
    const remainingBlocks = currentBlocks.filter((b) => !blockIds.includes(b._id));

    // Update parent of moved blocks
    const movedBlocks = blocksToMove.map((b) => ({ ...b, _parent: newParentId }));

    // Insert at new position
    const siblings = remainingBlocks.filter((b) => b._parent === newParentId);
    const nonSiblings = remainingBlocks.filter((b) => b._parent !== newParentId);
    const before = siblings.slice(0, position);
    const after = siblings.slice(position);

    set(blocksAtom, [...nonSiblings, ...before, ...movedBlocks, ...after]);
  }
);
