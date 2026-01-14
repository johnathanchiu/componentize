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
  canvasIframeAtom,
  draggingBlockAtom,
  dropIndicatorAtom,
  selectedBlockIdsAtom,
  type CanvasBreakpoint,
} from '@/atoms';
import { useUndoManager } from '@/atoms/history';
import type { Block, BoxBlock, HeadingBlock, TextBlock, ButtonBlock, AIComponentBlock } from '../../../shared/types';

// Sample blocks to start with
const STARTER_BLOCKS: Block[] = [
  // Hero section
  {
    _id: 'hero',
    _type: 'Box',
    _parent: null,
    _name: 'Hero Section',
    tag: 'section',
    styles: 'flex flex-col items-center justify-center py-24 px-8 bg-gradient-to-br from-indigo-600 to-purple-700 text-white',
  } as BoxBlock,
  {
    _id: 'hero-heading',
    _type: 'Heading',
    _parent: 'hero',
    _name: 'Hero Title',
    level: 1,
    content: 'Build Something Amazing',
    styles: 'text-5xl font-bold mb-4 text-center',
  } as HeadingBlock,
  {
    _id: 'hero-subtitle',
    _type: 'Text',
    _parent: 'hero',
    _name: 'Hero Subtitle',
    tag: 'p',
    content: 'Create beautiful interfaces with our block-based editor',
    styles: 'text-xl text-indigo-100 mb-8 text-center max-w-2xl',
  } as TextBlock,
  {
    _id: 'hero-buttons',
    _type: 'Box',
    _parent: 'hero',
    _name: 'Button Group',
    tag: 'div',
    styles: 'flex gap-4',
  } as BoxBlock,
  {
    _id: 'hero-cta',
    _type: 'Button',
    _parent: 'hero-buttons',
    _name: 'CTA Button',
    content: 'Get Started',
    variant: 'default',
    size: 'lg',
    styles: 'bg-white text-indigo-600 hover:bg-indigo-50',
  } as ButtonBlock,
  {
    _id: 'hero-secondary',
    _type: 'Button',
    _parent: 'hero-buttons',
    _name: 'Secondary Button',
    content: 'Learn More',
    variant: 'outline',
    size: 'lg',
    styles: 'border-white text-white hover:bg-white/10',
  } as ButtonBlock,

  // Features section
  {
    _id: 'features',
    _type: 'Box',
    _parent: null,
    _name: 'Features Section',
    tag: 'section',
    styles: 'py-20 px-8 bg-white',
  } as BoxBlock,
  {
    _id: 'features-heading',
    _type: 'Heading',
    _parent: 'features',
    _name: 'Features Title',
    level: 2,
    content: 'Why Choose Us',
    styles: 'text-3xl font-bold text-center mb-4 text-gray-900',
  } as HeadingBlock,
  {
    _id: 'features-subtitle',
    _type: 'Text',
    _parent: 'features',
    _name: 'Features Subtitle',
    tag: 'p',
    content: 'Everything you need to build modern web experiences',
    styles: 'text-gray-600 text-center mb-12 max-w-2xl mx-auto',
  } as TextBlock,
  {
    _id: 'features-grid',
    _type: 'Box',
    _parent: 'features',
    _name: 'Features Grid',
    tag: 'div',
    styles: 'grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto',
  } as BoxBlock,

  // Feature cards as AIComponents for interactivity
  {
    _id: 'feature-1',
    _type: 'AIComponent',
    _parent: 'features-grid',
    _name: 'Feature Card 1',
    componentName: 'FeatureCard1',
    code: `function FeatureCard1() {
  const [liked, setLiked] = useState(false);
  return (
    <Card className="p-6 text-center hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
        <Zap className="h-6 w-6 text-indigo-600" />
      </div>
      <h3 className="font-semibold text-lg mb-2">Lightning Fast</h3>
      <p className="text-gray-600 text-sm mb-4">Build and iterate quickly with our intuitive editor</p>
      <Button
        variant={liked ? "default" : "outline"}
        size="sm"
        onClick={() => setLiked(!liked)}
      >
        <Heart className={liked ? "h-4 w-4 mr-1 fill-current" : "h-4 w-4 mr-1"} />
        {liked ? 'Liked!' : 'Like'}
      </Button>
    </Card>
  );
}`,
  } as AIComponentBlock,
  {
    _id: 'feature-2',
    _type: 'AIComponent',
    _parent: 'features-grid',
    _name: 'Feature Card 2',
    componentName: 'FeatureCard2',
    code: `function FeatureCard2() {
  const [count, setCount] = useState(0);
  return (
    <Card className="p-6 text-center hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
        <Sparkles className="h-6 w-6 text-green-600" />
      </div>
      <h3 className="font-semibold text-lg mb-2">AI Powered</h3>
      <p className="text-gray-600 text-sm mb-4">Generate components with natural language</p>
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCount(c => c - 1)}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-8 text-center font-semibold">{count}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCount(c => c + 1)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}`,
  } as AIComponentBlock,
  {
    _id: 'feature-3',
    _type: 'AIComponent',
    _parent: 'features-grid',
    _name: 'Feature Card 3',
    componentName: 'FeatureCard3',
    code: `function FeatureCard3() {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="p-6 text-center hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
        <Code className="h-6 w-6 text-purple-600" />
      </div>
      <h3 className="font-semibold text-lg mb-2">Clean Code</h3>
      <p className="text-gray-600 text-sm mb-4">Export production-ready React components</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Show Less' : 'Show More'}
        <ChevronDown className={expanded ? "h-4 w-4 ml-1 rotate-180 transition-transform" : "h-4 w-4 ml-1 transition-transform"} />
      </Button>
      {expanded && (
        <p className="text-xs text-gray-500 mt-2 animate-in fade-in">
          Full TypeScript support with proper typing
        </p>
      )}
    </Card>
  );
}`,
  } as AIComponentBlock,

  // CTA Section
  {
    _id: 'cta',
    _type: 'Box',
    _parent: null,
    _name: 'CTA Section',
    tag: 'section',
    styles: 'py-16 px-8 bg-gray-900 text-white text-center',
  } as BoxBlock,
  {
    _id: 'cta-heading',
    _type: 'Heading',
    _parent: 'cta',
    _name: 'CTA Heading',
    level: 2,
    content: 'Ready to Get Started?',
    styles: 'text-3xl font-bold mb-4',
  } as HeadingBlock,
  {
    _id: 'cta-text',
    _type: 'Text',
    _parent: 'cta',
    _name: 'CTA Text',
    tag: 'p',
    content: 'Join thousands of developers building with blocks',
    styles: 'text-gray-400 mb-8',
  } as TextBlock,
  {
    _id: 'cta-button',
    _type: 'Button',
    _parent: 'cta',
    _name: 'CTA Button',
    content: 'Start Building Free',
    variant: 'default',
    size: 'lg',
    styles: 'bg-indigo-600 hover:bg-indigo-700',
  } as ButtonBlock,
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
  const [blocks, setBlocks] = useAtom(blocksAtom);
  const setSelectedIds = useSetAtom(selectedBlockIdsAtom);
  const canvasIframe = useAtomValue(canvasIframeAtom);
  const setDropIndicator = useSetAtom(dropIndicatorAtom);
  const [isOver, setIsOver] = useState(false);

  // Detect drop position and update indicator atom with iframe-relative coordinates
  const updateDropIndicator = (clientY: number) => {
    if (!canvasIframe?.contentDocument) {
      setDropIndicator({ isVisible: false, targetBlockId: null, position: 'after', top: 0, left: 0, width: 0 });
      return;
    }

    const iframeRect = canvasIframe.getBoundingClientRect();
    // Convert screen Y to iframe Y
    const iframeY = clientY - iframeRect.top;

    // Get all root-level blocks
    const rootBlockIds = blocks.filter(b => b._parent === null).map(b => b._id);
    const blockElements = canvasIframe.contentDocument.querySelectorAll('[data-block-id]');

    interface ClosestBlock {
      id: string;
      rect: DOMRect;
      position: 'before' | 'after';
      distance: number;
    }

    let closest: ClosestBlock | null = null;

    blockElements.forEach((el) => {
      const blockId = el.getAttribute('data-block-id');
      if (!blockId || !rootBlockIds.includes(blockId)) return;

      // Rect is in iframe coordinates
      const rect = el.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      const position: 'before' | 'after' = iframeY < middle ? 'before' : 'after';
      const edge = position === 'before' ? rect.top : rect.bottom;
      const distance = Math.abs(iframeY - edge);

      if (!closest || distance < closest.distance) {
        closest = { id: blockId, rect, position, distance };
      }
    });

    if (!closest) {
      setDropIndicator({ isVisible: false, targetBlockId: null, position: 'after', top: 0, left: 0, width: 0 });
      return;
    }

    const result = closest as ClosestBlock;
    setDropIndicator({
      isVisible: true,
      targetBlockId: result.id,
      position: result.position,
      top: result.position === 'before' ? result.rect.top : result.rect.bottom,
      left: result.rect.left,
      width: result.rect.width,
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isOver) setIsOver(true);
    updateDropIndicator(e.clientY);
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

    // Read current indicator state for insertion
    const indicator = canvasIframe?.contentDocument?.querySelector('[data-drop-indicator]');
    const targetBlockId = indicator?.getAttribute('data-target-block');
    const position = indicator?.getAttribute('data-position') as 'before' | 'after' | null;

    if (draggingBlock) {
      const newBlock = draggingBlock.createBlock();

      if (targetBlockId && position) {
        const targetIndex = blocks.findIndex(b => b._id === targetBlockId);
        if (targetIndex !== -1) {
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
          setBlocks((prev) => {
            const newBlocks = [...prev];
            newBlocks.splice(insertIndex, 0, newBlock);
            return newBlocks;
          });
        } else {
          setBlocks((prev) => [...prev, newBlock]);
        }
      } else {
        setBlocks((prev) => [...prev, newBlock]);
      }

      setSelectedIds([newBlock._id]);

      // Scroll to new block
      setTimeout(() => {
        if (canvasIframe?.contentDocument) {
          const blockElement = canvasIframe.contentDocument.querySelector(`[data-block-id="${newBlock._id}"]`);
          blockElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
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

      {/* Overlay message when no blocks to position against */}
      {isOver && draggingBlock && blocks.filter(b => b._parent === null).length === 0 && (
        <div className="absolute inset-0 bg-blue-500/10 pointer-events-none flex items-center justify-center">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg font-medium">
            Drop to add {draggingBlock.type}
          </div>
        </div>
      )}
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
