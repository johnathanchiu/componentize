/**
 * UI state atoms - selection, panels, canvas state
 */
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { Block } from '../../../shared/types';
import { blocksAtom } from './blocks';

// ============================================================================
// Selection Atoms
// ============================================================================

/**
 * Selected block IDs
 */
export const selectedBlockIdsAtom = atom<string[]>([]);
selectedBlockIdsAtom.debugLabel = 'selectedBlockIdsAtom';

/**
 * Derived: Selected blocks (full block objects)
 */
export const selectedBlocksAtom = atom((get) => {
  const blocks = get(blocksAtom);
  const selectedIds = get(selectedBlockIdsAtom);
  return blocks.filter((block) => selectedIds.includes(block._id));
});
selectedBlocksAtom.debugLabel = 'selectedBlocksAtom';

/**
 * Derived: Single selected block (when only one is selected)
 */
export const selectedBlockAtom = atom((get) => {
  const selected = get(selectedBlocksAtom);
  return selected.length === 1 ? selected[0] : null;
});
selectedBlockAtom.debugLabel = 'selectedBlockAtom';

/**
 * Derived: Selection hierarchy (selected block + all ancestors)
 */
export const selectedBlockHierarchyAtom = atom((get) => {
  const selectedBlock = get(selectedBlockAtom);
  if (!selectedBlock) return [];

  const blocks = get(blocksAtom);
  const hierarchy: Block[] = [selectedBlock];

  let current: Block | undefined = selectedBlock;
  while (current?._parent) {
    const parent = blocks.find((b) => b._id === current!._parent);
    if (parent) {
      hierarchy.push(parent);
      current = parent;
    } else {
      break;
    }
  }

  return hierarchy;
});
selectedBlockHierarchyAtom.debugLabel = 'selectedBlockHierarchyAtom';

// ============================================================================
// Panel State
// ============================================================================

export type SidePanel = 'blocks' | 'outline' | 'ai' | 'settings';
export type RightPanel = 'properties' | 'code' | 'none';

/**
 * Active left panel
 */
export const activeSidePanelAtom = atomWithStorage<SidePanel>('activeSidePanel', 'blocks');
activeSidePanelAtom.debugLabel = 'activeSidePanelAtom';

/**
 * Active right panel
 */
export const activeRightPanelAtom = atomWithStorage<RightPanel>('activeRightPanel', 'properties');
activeRightPanelAtom.debugLabel = 'activeRightPanelAtom';

// ============================================================================
// Canvas State
// ============================================================================

export type CanvasBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Canvas breakpoint for responsive preview
 */
export const canvasBreakpointAtom = atomWithStorage<CanvasBreakpoint>('canvasBreakpoint', 'lg');
canvasBreakpointAtom.debugLabel = 'canvasBreakpointAtom';

/**
 * Breakpoint widths
 */
export const breakpointWidths: Record<CanvasBreakpoint, number> = {
  'xs': 375,
  'sm': 640,
  'md': 768,
  'lg': 1024,
  'xl': 1280,
  '2xl': 1536,
};

/**
 * Canvas zoom level (percentage)
 */
export const canvasZoomAtom = atomWithStorage<number>('canvasZoom', 100);
canvasZoomAtom.debugLabel = 'canvasZoomAtom';

/**
 * Canvas iframe reference
 */
export const canvasIframeAtom = atom<HTMLIFrameElement | null>(null);
canvasIframeAtom.debugLabel = 'canvasIframeAtom';

/**
 * Is dragging a block
 */
export const isDraggingAtom = atom(false);
isDraggingAtom.debugLabel = 'isDraggingAtom';

/**
 * Drop target info
 */
export const dropTargetAtom = atom<{
  parentId: string | null;
  position: number;
} | null>(null);
dropTargetAtom.debugLabel = 'dropTargetAtom';

// ============================================================================
// Editor State
// ============================================================================

/**
 * Read-only mode
 */
export const readOnlyModeAtom = atom(false);
readOnlyModeAtom.debugLabel = 'readOnlyModeAtom';

/**
 * Inline editing active (block ID being edited)
 */
export const inlineEditingBlockIdAtom = atom<string | null>(null);
inlineEditingBlockIdAtom.debugLabel = 'inlineEditingBlockIdAtom';

/**
 * Code editor open for AIComponent
 */
export const codeEditorOpenAtom = atom(false);
codeEditorOpenAtom.debugLabel = 'codeEditorOpenAtom';

/**
 * Code editor height (persisted)
 */
export const codeEditorHeightAtom = atomWithStorage<number>('codeEditorHeight', 400);
codeEditorHeightAtom.debugLabel = 'codeEditorHeightAtom';

// ============================================================================
// AI Generation State
// ============================================================================

/**
 * AI assistant panel open
 */
export const aiAssistantOpenAtom = atom(false);
aiAssistantOpenAtom.debugLabel = 'aiAssistantOpenAtom';

/**
 * AI is generating
 */
export const aiGeneratingAtom = atom(false);
aiGeneratingAtom.debugLabel = 'aiGeneratingAtom';

/**
 * Current AI prompt
 */
export const aiPromptAtom = atom('');
aiPromptAtom.debugLabel = 'aiPromptAtom';

// ============================================================================
// Save State
// ============================================================================

export type SaveState = 'SAVED' | 'UNSAVED' | 'SAVING' | 'ERROR';

export const saveStateAtom = atom<SaveState>('SAVED');
saveStateAtom.debugLabel = 'saveStateAtom';
