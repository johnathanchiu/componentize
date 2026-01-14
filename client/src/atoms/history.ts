/**
 * Undo/Redo history management
 * Based on chaibuilder's pattern using undo-manager
 */
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
import UndoManager from 'undo-manager';
import type { Block } from '../../../shared/types';
import { blocksAtom, setBlocksAtom, addBlocksAtom, removeBlocksAtom, updateBlocksAtom, moveBlocksAtom } from './blocks';
import { saveStateAtom } from './ui';

// ============================================================================
// Undo Manager Instance
// ============================================================================

const undoManager = new UndoManager();
undoManager.setLimit(100);

export { undoManager };

// ============================================================================
// Undo/Redo State Atom
// ============================================================================

export const undoRedoStateAtom = atom({
  canUndo: false,
  canRedo: false,
});
undoRedoStateAtom.debugLabel = 'undoRedoStateAtom';

// ============================================================================
// Undo Manager Hook
// ============================================================================

export const useUndoManager = () => {
  const setSaveState = useSetAtom(saveStateAtom);
  const [undoRedoState, setUndoRedoState] = useAtom(undoRedoStateAtom);

  const updateUndoRedoState = useCallback(() => {
    setUndoRedoState({
      canUndo: undoManager.hasUndo(),
      canRedo: undoManager.hasRedo(),
    });
    setSaveState('UNSAVED');
  }, [setUndoRedoState, setSaveState]);

  useEffect(() => {
    undoManager.setCallback(updateUndoRedoState);
    return () => {
      undoManager.setCallback(() => {});
    };
  }, [updateUndoRedoState]);

  const add = useCallback(
    (action: { undo: () => void; redo: () => void }) => {
      undoManager.add(action);
      updateUndoRedoState();
    },
    [updateUndoRedoState]
  );

  const undo = useCallback(() => {
    undoManager.undo();
    updateUndoRedoState();
  }, [updateUndoRedoState]);

  const redo = useCallback(() => {
    undoManager.redo();
    updateUndoRedoState();
  }, [updateUndoRedoState]);

  const clear = useCallback(() => {
    undoManager.clear();
    setUndoRedoState({ canUndo: false, canRedo: false });
  }, [setUndoRedoState]);

  return useMemo(
    () => ({
      add,
      undo,
      redo,
      clear,
      canUndo: undoRedoState.canUndo,
      canRedo: undoRedoState.canRedo,
    }),
    [add, undo, redo, clear, undoRedoState.canUndo, undoRedoState.canRedo]
  );
};

// ============================================================================
// Undoable Block Actions Hook
// ============================================================================

/**
 * Hook that provides undoable block operations
 * All operations are wrapped with undo/redo support
 */
export const useBlocksUndoableActions = () => {
  const { add } = useUndoManager();
  const blocks = useAtomValue(blocksAtom);
  const setBlocks = useSetAtom(setBlocksAtom);
  const addBlocksRaw = useSetAtom(addBlocksAtom);
  const removeBlocksRaw = useSetAtom(removeBlocksAtom);
  const updateBlocksRaw = useSetAtom(updateBlocksAtom);
  const moveBlocksRaw = useSetAtom(moveBlocksAtom);

  /**
   * Set all blocks (replaces entire state)
   */
  const setNewBlocks = useCallback(
    (newBlocks: Block[]) => {
      const previousBlocks = [...blocks];
      setBlocks(newBlocks);
      add({
        undo: () => setBlocks(previousBlocks),
        redo: () => setBlocks(newBlocks),
      });
    },
    [blocks, setBlocks, add]
  );

  /**
   * Add blocks with undo support
   */
  const addBlocks = useCallback(
    (newBlocks: Block[], parentId?: string | null, position?: number) => {
      const blockIds = newBlocks.map((b) => b._id);
      addBlocksRaw({ blocks: newBlocks, parentId, position });
      add({
        undo: () => removeBlocksRaw(blockIds),
        redo: () => addBlocksRaw({ blocks: newBlocks, parentId, position }),
      });
    },
    [addBlocksRaw, removeBlocksRaw, add]
  );

  /**
   * Remove blocks with undo support
   */
  const removeBlocks = useCallback(
    (blocksToRemove: Block[]) => {
      const blockIds = blocksToRemove.map((b) => b._id);

      // Save position info for undo
      const firstBlock = blocksToRemove[0];
      const parentId = firstBlock?._parent ?? null;
      const siblings = blocks.filter((b) => b._parent === parentId);
      const position = siblings.findIndex((b) => b._id === firstBlock?._id);

      removeBlocksRaw(blockIds);
      add({
        undo: () => addBlocksRaw({ blocks: blocksToRemove, parentId, position }),
        redo: () => removeBlocksRaw(blockIds),
      });
    },
    [blocks, addBlocksRaw, removeBlocksRaw, add]
  );

  /**
   * Update blocks with undo support
   */
  const updateBlocks = useCallback(
    (updates: Array<{ _id: string } & Partial<Block>>) => {
      // Save previous state for undo
      const previousState = updates.map((update) => {
        const block = blocks.find((b) => b._id === update._id);
        if (!block) return { _id: update._id };

        const prevProps: Record<string, unknown> = { _id: update._id };
        Object.keys(update).forEach((key) => {
          if (key !== '_id') {
            prevProps[key] = (block as Record<string, unknown>)[key];
          }
        });
        return prevProps as { _id: string } & Partial<Block>;
      });

      updateBlocksRaw(updates);
      add({
        undo: () => updateBlocksRaw(previousState),
        redo: () => updateBlocksRaw(updates),
      });
    },
    [blocks, updateBlocksRaw, add]
  );

  /**
   * Move blocks with undo support
   */
  const moveBlocks = useCallback(
    (blockIds: string[], newParentId: string | null, position: number) => {
      // Save current positions for undo
      const currentPositions = blockIds.map((id) => {
        const block = blocks.find((b) => b._id === id);
        const oldParent = block?._parent ?? null;
        const siblings = blocks.filter((b) => b._parent === oldParent);
        const oldPosition = siblings.findIndex((b) => b._id === id);
        return { id, oldParent, oldPosition };
      });

      // Check if actually moving
      const firstPos = currentPositions[0];
      if (firstPos && firstPos.oldParent === newParentId && firstPos.oldPosition === position) {
        return;
      }

      moveBlocksRaw({ blockIds, newParentId, position });
      add({
        undo: () => {
          currentPositions.forEach(({ id, oldParent, oldPosition }) => {
            moveBlocksRaw({ blockIds: [id], newParentId: oldParent, position: oldPosition });
          });
        },
        redo: () => moveBlocksRaw({ blockIds, newParentId, position }),
      });
    },
    [blocks, moveBlocksRaw, add]
  );

  /**
   * Duplicate blocks
   */
  const duplicateBlocks = useCallback(
    (blockIds: string[]) => {
      const blocksToDuplicate = blocks.filter((b) => blockIds.includes(b._id));
      if (blocksToDuplicate.length === 0) return;

      // Generate new IDs for duplicated blocks
      const duplicatedBlocks = blocksToDuplicate.map((block) => ({
        ...block,
        _id: `${block._id}-copy-${Date.now()}`,
        _name: block._name ? `${block._name} (copy)` : undefined,
      }));

      // Find position (after the original blocks)
      const firstBlock = blocksToDuplicate[0];
      const parentId = firstBlock._parent;
      const siblings = blocks.filter((b) => b._parent === parentId);
      const lastOriginalIndex = Math.max(
        ...blocksToDuplicate.map((b) => siblings.findIndex((s) => s._id === b._id))
      );
      const position = lastOriginalIndex + 1;

      addBlocks(duplicatedBlocks, parentId, position);
    },
    [blocks, addBlocks]
  );

  return {
    setNewBlocks,
    addBlocks,
    removeBlocks,
    updateBlocks,
    moveBlocks,
    duplicateBlocks,
  };
};
