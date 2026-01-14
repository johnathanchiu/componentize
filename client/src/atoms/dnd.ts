/**
 * Drag and drop state atoms
 * Uses native HTML5 DnD with Jotai for state management
 */
import { atom } from 'jotai';
import type { Block } from '../../../shared/types';

/**
 * Currently dragged block data from library
 */
export const draggingBlockAtom = atom<{
  type: string;
  createBlock: () => Block;
} | null>(null);

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
