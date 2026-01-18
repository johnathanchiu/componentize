/**
 * BlockEditor - New block-based editor page
 * Replaces the legacy React Flow canvas
 */
import React, { useEffect, useState } from 'react';
import { Provider, useSetAtom, useAtom, useAtomValue } from 'jotai';
import { Undo, Redo, Layers, Plus, Settings, Monitor, Tablet, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BlockCanvas } from '@/components/canvas';
import { BlockLibrary, PropertiesPanel, OutlineTree } from '@/components/panels';
import { cn } from '@/lib/utils';
import {
  blocksAtom,
  canvasBreakpointAtom,
  canvasViewportGetterAtom,
  draggingBlockAtom,
  dropIndicatorAtom,
  selectedBlockIdsAtom,
  type CanvasBreakpoint,
} from '@/atoms';
import { useUndoManager } from '@/atoms/history';
import type { Block, HeadingBlock, TextBlock, ButtonBlock } from '../../../shared/types';

// Sample positioned blocks for free-form canvas demo
const STARTER_BLOCKS: Block[] = [
  // A heading positioned at top-left
  {
    _id: 'heading-1',
    _type: 'Heading',
    _parent: null,
    _name: 'Welcome Heading',
    level: 1,
    content: 'Welcome to the Canvas',
    styles: 'text-3xl font-bold text-gray-900',
    _position: { x: 50, y: 50 },
    _size: { width: 300, height: 60 },
  } as HeadingBlock,
  // A button positioned below and to the right
  {
    _id: 'button-1',
    _type: 'Button',
    _parent: null,
    _name: 'Action Button',
    content: 'Click Me',
    variant: 'default',
    size: 'lg',
    styles: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    _position: { x: 100, y: 150 },
    _size: { width: 150, height: 50 },
  } as ButtonBlock,
  // A text block
  {
    _id: 'text-1',
    _type: 'Text',
    _parent: null,
    _name: 'Description',
    tag: 'p',
    content: 'Drag blocks from the library to add them to your design. Drag existing blocks to reposition them.',
    styles: 'text-gray-600',
    _position: { x: 50, y: 250 },
    _size: { width: 400, height: 80 },
  } as TextBlock,
];

interface BlockEditorProps {
  initialBlocks?: Block[];
  projectId?: string;
  onBack?: () => void;
}

/**
 * Toolbar with undo/redo and breakpoint controls
 */
const EditorToolbar: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { undo, redo, canUndo, canRedo } = useUndoManager();
  const [breakpoint, setBreakpoint] = useAtom(canvasBreakpointAtom);

  // Need to import useAtom
  const breakpoints: { value: CanvasBreakpoint; icon: React.FC<{ className?: string }>; label: string }[] = [
    { value: 'lg', icon: Monitor, label: 'Desktop' },
    { value: 'md', icon: Tablet, label: 'Tablet' },
    { value: 'xs', icon: Smartphone, label: 'Mobile' },
  ];

  return (
    <div className="h-12 border-b bg-white flex items-center justify-between px-4">
      {/* Left: Back + Title */}
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
        )}
        <span className="font-medium">Block Editor</span>
      </div>

      {/* Center: Breakpoints */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {breakpoints.map(({ value, icon: Icon, label }) => (
          <Button
            key={value}
            variant={breakpoint === value ? 'default' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setBreakpoint(value)}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      {/* Right: Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={!canUndo}
          className="h-8 w-8 p-0"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={!canRedo}
          className="h-8 w-8 p-0"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};


/**
 * Left sidebar with tabs
 */
const LeftSidebar: React.FC = () => {
  return (
    <div className="w-64 shrink-0 border-r bg-white flex flex-col overflow-hidden">
      <Tabs defaultValue="blocks" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2 p-1 shrink-0">
          <TabsTrigger value="blocks" className="text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Blocks
          </TabsTrigger>
          <TabsTrigger value="outline" className="text-xs">
            <Layers className="h-3 w-3 mr-1" />
            Outline
          </TabsTrigger>
        </TabsList>
        <TabsContent value="blocks" className="flex-1 overflow-auto m-0 min-h-0">
          <BlockLibrary />
        </TabsContent>
        <TabsContent value="outline" className="flex-1 overflow-auto m-0 min-h-0">
          <OutlineTree />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/**
 * Right sidebar with properties
 */
const RightSidebar: React.FC = () => {
  return (
    <div className="w-72 shrink-0 border-l bg-white flex flex-col overflow-hidden">
      <div className="p-3 border-b shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Settings className="h-4 w-4" />
          Properties
        </div>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        <PropertiesPanel />
      </div>
    </div>
  );
};

/**
 * Canvas drop zone - handles native HTML5 drag and drop with position detection
 * Indicator is rendered INSIDE the iframe via dropIndicatorAtom
 */
const CanvasDropZone: React.FC = () => {
  const draggingBlock = useAtomValue(draggingBlockAtom);
  const setBlocks = useSetAtom(blocksAtom);
  const setSelectedIds = useSetAtom(selectedBlockIdsAtom);
  const getViewport = useAtomValue(canvasViewportGetterAtom);
  const setDropIndicator = useSetAtom(dropIndicatorAtom);
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isOver) setIsOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      setIsOver(false);
      setDropIndicator({ isVisible: false, targetBlockId: null, position: 'after', top: 0, left: 0, width: 0 });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);

    if (draggingBlock) {
      const newBlock = draggingBlock.createBlock();

      // Get current viewport from getter (avoids stale state during animations)
      const viewport = getViewport?.() ?? { x: 0, y: 0, zoom: 1 };

      // Calculate drop position relative to canvas container
      const containerRect = e.currentTarget.getBoundingClientRect();

      // Screen position relative to the drop zone container
      const screenX = e.clientX - containerRect.left;
      const screenY = e.clientY - containerRect.top;

      // Convert screen coordinates to canvas coordinates (accounting for pan/zoom)
      const canvasX = (screenX - viewport.x) / viewport.zoom;
      const canvasY = (screenY - viewport.y) / viewport.zoom;

      // Assign position and default size for free-form positioning
      const positionedBlock = {
        ...newBlock,
        _position: { x: Math.max(0, canvasX), y: Math.max(0, canvasY) },
        _size: { width: 200, height: 100 }, // Default size
      };

      setBlocks((prev) => [...prev, positionedBlock]);
      setSelectedIds([positionedBlock._id]);
    }

    setDropIndicator({ isVisible: false, targetBlockId: null, position: 'after', top: 0, left: 0, width: 0 });
  };

  return (
    <div
      className={cn(
        'flex-1 min-w-0 overflow-hidden relative',
        isOver && 'ring-4 ring-inset ring-blue-400'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <BlockCanvas className="h-full w-full" />
    </div>
  );
};

/**
 * Editor content - wrapped in Jotai Provider
 */
const EditorContent: React.FC<BlockEditorProps> = ({ initialBlocks = STARTER_BLOCKS, onBack }) => {
  const setBlocks = useSetAtom(blocksAtom);

  // Initialize blocks
  useEffect(() => {
    setBlocks(initialBlocks);
  }, [initialBlocks, setBlocks]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 overflow-hidden">
      <EditorToolbar onBack={onBack} />
      <div className="flex-1 flex min-h-0">
        <LeftSidebar />
        <CanvasDropZone />
        <RightSidebar />
      </div>
    </div>
  );
};

/**
 * BlockEditor - Main export with Provider wrapper
 */
export const BlockEditor: React.FC<BlockEditorProps> = (props) => {
  return (
    <Provider>
      <EditorContent {...props} />
    </Provider>
  );
};

export default BlockEditor;
