/**
 * BlockCanvas - Iframe-based canvas for rendering blocks
 * Provides style isolation, pan/zoom, and free-form positioning
 */
import React, { useCallback, useRef, useEffect } from 'react';
import Frame from 'react-frame-component';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  blocksAtom,
  selectedBlockIdsAtom,
  canvasIframeAtom,
  canvasViewportGetterAtom,
  dropIndicatorAtom,
  draggingBlockAtom,
} from '../../atoms';
import { BlockTreeRenderer } from './BlockTreeRenderer';
import { usePanZoom } from '../../hooks/usePanZoom';

// Initial HTML for the iframe
const INITIAL_CONTENT = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.tailwindcss.com"></script>
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
 * Canvas content - rendered inside the iframe
 */
const CanvasContent: React.FC = () => {
  const blocks = useAtomValue(blocksAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedBlockIdsAtom);
  const dropIndicator = useAtomValue(dropIndicatorAtom);

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
        className="flex items-center justify-center h-full min-h-[400px] text-gray-400 relative"
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
      style={{ position: 'relative', minHeight: '100vh' }}
    >
      {/* Drop indicator - rendered inside iframe */}
      {dropIndicator.isVisible && (
        <div
          data-drop-indicator
          data-target-block={dropIndicator.targetBlockId}
          data-position={dropIndicator.position}
          className="pointer-events-none absolute z-[99999] h-0.5 bg-blue-500 rounded-full"
          style={{
            top: dropIndicator.top,
            left: dropIndicator.left,
            width: dropIndicator.width,
          }}
        />
      )}

      <BlockTreeRenderer
        blocks={blocks}
        selectedIds={selectedIds}
        onBlockClick={handleBlockClick}
      />
    </div>
  );
};

/**
 * BlockCanvas - Main canvas component with iframe and pan/zoom
 */
export const BlockCanvas: React.FC<BlockCanvasProps> = ({ className = '' }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const setCanvasIframe = useSetAtom(canvasIframeAtom);
  const setViewportGetter = useSetAtom(canvasViewportGetterAtom);
  const draggingBlock = useAtomValue(draggingBlockAtom);
  const isDragging = draggingBlock !== null;

  // Use the pan/zoom hook - handles all interaction with refs + RAF
  const {
    containerRef,
    contentRef,
    isPanning,
    isSpaceHeld,
    displayZoom,
    getViewport,
  } = usePanZoom({ minZoom: 0.25, maxZoom: 2 });

  // Store getViewport in atom for drop position calculations
  useEffect(() => {
    setViewportGetter(() => getViewport);
  }, [getViewport, setViewportGetter]);

  // Store iframe ref in atom for external access
  const handleMount = useCallback(() => {
    if (iframeRef.current) {
      setCanvasIframe(iframeRef.current);
    }
  }, [setCanvasIframe]);

  // Canvas size - make it large for free-form positioning
  const canvasWidth = 3000;
  const canvasHeight = 2000;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-100 ${className}`}
      style={{ cursor: isPanning ? 'grabbing' : isSpaceHeld ? 'grab' : 'default' }}
    >
      {/* Zoom indicator */}
      <div className="absolute top-2 right-2 z-10 bg-white/80 px-2 py-1 rounded text-xs text-gray-600">
        {Math.round(displayZoom * 100)}%
      </div>

      {/* Canvas viewport container - transform applied directly by hook */}
      <div
        ref={contentRef}
        style={{
          transformOrigin: '0 0',
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        <Frame
          ref={iframeRef}
          initialContent={INITIAL_CONTENT}
          mountTarget=".canvas-root"
          className="bg-white shadow-lg border-0"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            pointerEvents: isDragging || isPanning || isSpaceHeld ? 'none' : 'auto',
          }}
          contentDidMount={handleMount}
        >
          <CanvasContent />
        </Frame>
      </div>

      {/* Pan/zoom hint */}
      <div className="absolute bottom-2 left-2 z-10 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
        Hold Space: drag to pan, scroll to zoom
      </div>
    </div>
  );
};

export default BlockCanvas;
