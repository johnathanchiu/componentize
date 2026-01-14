/**
 * BlockCanvas - Iframe-based canvas for rendering blocks
 * Provides style isolation and accurate preview
 */
import React, { useCallback, useEffect, useRef } from 'react';
import Frame, { FrameContextConsumer } from 'react-frame-component';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  blocksAtom,
  selectedBlockIdsAtom,
  canvasIframeAtom,
  canvasBreakpointAtom,
  breakpointWidths,
  canvasZoomAtom,
} from '../../atoms';
import { BlockTreeRenderer } from './BlockTreeRenderer';

// Initial HTML for the iframe
const INITIAL_CONTENT = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      *, *::before, *::after {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .canvas-root {
        min-height: 100vh;
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <div class="canvas-root"></div>
  </body>
</html>
`;

interface BlockCanvasProps {
  className?: string;
}

/**
 * Inject Tailwind styles into iframe
 */
const TailwindInjector: React.FC = () => {
  return (
    <FrameContextConsumer>
      {({ document: iframeDoc }) => {
        // Inject Tailwind CSS
        useEffect(() => {
          if (!iframeDoc) return;

          // Create link to Tailwind CDN (for development)
          // In production, you'd inject the compiled CSS
          const link = iframeDoc.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://cdn.tailwindcss.com';
          iframeDoc.head.appendChild(link);

          // Also inject Tailwind script for JIT
          const script = iframeDoc.createElement('script');
          script.src = 'https://cdn.tailwindcss.com';
          iframeDoc.head.appendChild(script);

          return () => {
            link.remove();
            script.remove();
          };
        }, [iframeDoc]);

        return null;
      }}
    </FrameContextConsumer>
  );
};

/**
 * Canvas content - rendered inside the iframe
 */
const CanvasContent: React.FC = () => {
  const blocks = useAtomValue(blocksAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedBlockIdsAtom);

  const handleBlockClick = useCallback(
    (blockId: string, e: React.MouseEvent) => {
      if (e.shiftKey || e.metaKey) {
        // Multi-select
        setSelectedIds((prev) =>
          prev.includes(blockId)
            ? prev.filter((id) => id !== blockId)
            : [...prev, blockId]
        );
      } else {
        // Single select
        setSelectedIds([blockId]);
      }
    },
    [setSelectedIds]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Click on canvas background deselects all
      if (e.target === e.currentTarget) {
        setSelectedIds([]);
      }
    },
    [setSelectedIds]
  );

  if (blocks.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full min-h-[400px] text-gray-400"
        onClick={handleCanvasClick}
      >
        <div className="text-center">
          <div className="text-4xl mb-2">+</div>
          <div>Add blocks or generate with AI</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="canvas-content min-h-full"
      onClick={handleCanvasClick}
    >
      <BlockTreeRenderer
        blocks={blocks}
        selectedIds={selectedIds}
        onBlockClick={handleBlockClick}
      />
    </div>
  );
};

/**
 * BlockCanvas - Main canvas component with iframe
 */
export const BlockCanvas: React.FC<BlockCanvasProps> = ({ className = '' }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const setCanvasIframe = useSetAtom(canvasIframeAtom);
  const breakpoint = useAtomValue(canvasBreakpointAtom);
  const zoom = useAtomValue(canvasZoomAtom);

  const width = breakpointWidths[breakpoint];
  const scale = zoom / 100;

  // Store iframe ref in atom for external access
  const handleMount = useCallback(() => {
    if (iframeRef.current) {
      setCanvasIframe(iframeRef.current);
    }
  }, [setCanvasIframe]);

  return (
    <div className={`relative flex-1 overflow-auto bg-gray-100 ${className}`}>
      <div
        className="mx-auto transition-all duration-200"
        style={{
          width: `${width}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        <Frame
          ref={iframeRef}
          initialContent={INITIAL_CONTENT}
          mountTarget=".canvas-root"
          className="w-full min-h-screen bg-white shadow-lg border-0"
          contentDidMount={handleMount}
        >
          <TailwindInjector />
          <CanvasContent />
        </Frame>
      </div>
    </div>
  );
};

export default BlockCanvas;
