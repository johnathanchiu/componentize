/**
 * Test page for the new block-based canvas
 * Access at /test-blocks
 */
import React from 'react';
import { Provider, useSetAtom } from 'jotai';
import { BlockCanvas } from '@/components/canvas';
import { blocksAtom } from '@/atoms';
import type { Block, BoxBlock, HeadingBlock, TextBlock, ButtonBlock, AIComponentBlock } from '../../../shared/types';

// Sample blocks for testing
const SAMPLE_BLOCKS: Block[] = [
  // Hero section container
  {
    _id: 'hero',
    _type: 'Box',
    _parent: null,
    _name: 'Hero Section',
    tag: 'section',
    styles: 'flex flex-col items-center justify-center py-20 px-8 bg-gradient-to-b from-slate-900 to-slate-800 text-white',
  } as BoxBlock,

  // Hero heading
  {
    _id: 'hero-heading',
    _type: 'Heading',
    _parent: 'hero',
    _name: 'Hero Title',
    level: 1,
    content: 'Build Beautiful UIs with Blocks',
    styles: 'text-5xl font-bold mb-4 text-center',
  } as HeadingBlock,

  // Hero subtitle
  {
    _id: 'hero-text',
    _type: 'Text',
    _parent: 'hero',
    _name: 'Hero Subtitle',
    tag: 'p',
    content: 'A new way to create React components visually',
    styles: 'text-xl text-slate-300 mb-8 text-center',
  } as TextBlock,

  // Button row
  {
    _id: 'button-row',
    _type: 'Box',
    _parent: 'hero',
    _name: 'Button Row',
    tag: 'div',
    styles: 'flex gap-4',
  } as BoxBlock,

  // Primary button
  {
    _id: 'cta-button',
    _type: 'Button',
    _parent: 'button-row',
    _name: 'CTA Button',
    content: 'Get Started',
    variant: 'default',
    size: 'lg',
    styles: 'bg-blue-600 hover:bg-blue-700',
  } as ButtonBlock,

  // Secondary button
  {
    _id: 'secondary-button',
    _type: 'Button',
    _parent: 'button-row',
    _name: 'Secondary Button',
    content: 'Learn More',
    variant: 'outline',
    size: 'lg',
  } as ButtonBlock,

  // Features section
  {
    _id: 'features',
    _type: 'Box',
    _parent: null,
    _name: 'Features Section',
    tag: 'section',
    styles: 'py-16 px-8 bg-white',
  } as BoxBlock,

  {
    _id: 'features-heading',
    _type: 'Heading',
    _parent: 'features',
    level: 2,
    content: 'Features',
    styles: 'text-3xl font-bold text-center mb-12 text-slate-900',
  } as HeadingBlock,

  // AI Component example
  {
    _id: 'counter',
    _type: 'AIComponent',
    _parent: 'features',
    _name: 'Interactive Counter',
    componentName: 'Counter',
    code: `
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <Card className="max-w-sm mx-auto">
      <CardHeader>
        <CardTitle>Interactive Counter</CardTitle>
        <CardDescription>This is an AIComponent with useState</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setCount(c => c - 1)}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className="text-4xl font-bold w-16 text-center">{count}</span>
        <Button variant="outline" size="icon" onClick={() => setCount(c => c + 1)}>
          <Plus className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
    `,
  } as AIComponentBlock,
];

// Component to initialize blocks
const BlockInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setBlocks = useSetAtom(blocksAtom);

  React.useEffect(() => {
    setBlocks(SAMPLE_BLOCKS);
  }, [setBlocks]);

  return <>{children}</>;
};

export const BlockCanvasTest: React.FC = () => {
  return (
    <Provider>
      <BlockInitializer>
        <div className="h-screen flex flex-col">
          <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold">Block Canvas Test</h1>
            <a href="/" className="text-sm text-slate-300 hover:text-white">
              ← Back to Editor
            </a>
          </header>
          <BlockCanvas className="flex-1" />
        </div>
      </BlockInitializer>
    </Provider>
  );
};

export default BlockCanvasTest;
