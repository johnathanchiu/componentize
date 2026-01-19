/**
 * Jotai atoms and hooks for block-based editor
 */

// Block atoms
export {
  blocksAtom,
  blockAtomsAtom,
  rootBlocksAtom,
  blockTreeAtom,
  getBlockChildrenAtom,
  getBlockByIdAtom,
  blockCountAtom,
  setBlocksAtom,
  addBlocksAtom,
  removeBlocksAtom,
  updateBlocksAtom,
  moveBlocksAtom,
  type BlockTreeNode,
} from './blocks';

// UI atoms
export {
  selectedBlockIdsAtom,
  selectedBlocksAtom,
  selectedBlockAtom,
  selectedBlockHierarchyAtom,
  activeSidePanelAtom,
  activeRightPanelAtom,
  canvasBreakpointAtom,
  breakpointWidths,
  canvasZoomAtom,
  canvasViewportAtom,
  canvasViewportGetterAtom,
  canvasIframeAtom,
  isDraggingAtom,
  dropTargetAtom,
  readOnlyModeAtom,
  inlineEditingBlockIdAtom,
  codeEditorOpenAtom,
  codeEditorHeightAtom,
  aiAssistantOpenAtom,
  aiGeneratingAtom,
  aiPromptAtom,
  saveStateAtom,
  type SidePanel,
  type RightPanel,
  type CanvasBreakpoint,
  type CanvasViewport,
  type SaveState,
} from './ui';

// History atoms and hooks
export {
  undoManager,
  undoRedoStateAtom,
  useUndoManager,
  useBlocksUndoableActions,
} from './history';

// Drag and drop atoms
export {
  draggingBlockAtom,
  canvasDraggingBlockIdAtom,
  canvasDropIndicatorAtom,
  dropIndicatorAtom,
  type DropIndicatorState,
  type CanvasDropIndicator,
} from './dnd';
