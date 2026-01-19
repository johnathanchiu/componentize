/**
 * InlineTextEditor - Tiptap-based inline text editing for blocks
 */
import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useSetAtom } from 'jotai';
import { inlineEditingBlockIdAtom } from '../../atoms';
import { useBlocksUndoableActions } from '../../atoms/history';

interface InlineTextEditorProps {
  blockId: string;
  initialContent: string;
  className?: string;
  tag?: string;
}

export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  blockId,
  initialContent,
  className = '',
  tag = 'p',
}) => {
  const setEditingBlockId = useSetAtom(inlineEditingBlockIdAtom);
  const { updateBlocks } = useBlocksUndoableActions();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable block-level elements for inline editing
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
    ],
    content: initialContent,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: `outline-none ${className}`,
      },
    },
  });

  // Save content and exit editing mode
  const handleSave = useCallback(() => {
    if (!editor) return;

    const newContent = editor.getText();
    if (newContent !== initialContent) {
      updateBlocks([{ _id: blockId, content: newContent }]);
    }
    setEditingBlockId(null);
  }, [editor, blockId, initialContent, updateBlocks, setEditingBlockId]);

  // Handle blur - save and exit
  const handleBlur = useCallback(() => {
    // Small delay to allow clicking on toolbar buttons
    setTimeout(() => {
      handleSave();
    }, 150);
  }, [handleSave]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  if (!editor) return null;

  // Use React.createElement to render with dynamic tag
  return React.createElement(
    tag,
    { className },
    <EditorContent
      editor={editor}
      onBlur={handleBlur}
      className="inline-editor"
    />
  );
};

export default InlineTextEditor;
