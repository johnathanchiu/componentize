/**
 * Drag and drop state atoms
 * Uses native HTML5 DnD with Jotai for state management
 */
import { atom } from 'jotai';
import type { Block } from '../../../shared/types';

/**
 * Currently dragged block data from library (for adding new blocks)
 */
export const draggingBlockAtom = atom<{
  type: string;
  createBlock: () => Block;
} | null>(null);

/**
 * Currently dragged block ID on canvas (for moving existing blocks)
 * Set when Cmd+dragging a block on the canvas
 */
export const canvasDraggingBlockIdAtom = atom<string | null>(null);

/**
 * Canvas drop indicator for block reordering
 */
export interface CanvasDropIndicator {
  targetBlockId: string;
  position: 'before' | 'after';
}

export const canvasDropIndicatorAtom = atom<CanvasDropIndicator | null>(null);

/**
 * Drop indicator state - rendered INSIDE the iframe
 * Coordinates are relative to iframe document, not screen
 */
export interface DropIndicatorState {
  isVisible: boolean;
  targetBlockId: string | null;
  position: 'before' | 'after';
  // Coordinates relative to iframe document
  top: number;
  left: number;
  width: number;
}

export const dropIndicatorAtom = atom<DropIndicatorState>({
  isVisible: false,
  targetBlockId: null,
  position: 'after',
  top: 0,
  left: 0,
  width: 0,
});
