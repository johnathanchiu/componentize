import { useState, useEffect } from 'react';

/**
 * Custom hook to track Cmd/Ctrl key state.
 * Returns true when Cmd (Mac) or Ctrl (Windows/Linux) is held down.
 *
 * Used to toggle between:
 * - Normal mode: interact with component content (click buttons, inputs, etc.)
 * - Edit mode: drag, select, resize components via React Flow
 */
export function useCmdKey(): boolean {
  const [cmdKeyHeld, setCmdKeyHeld] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) setCmdKeyHeld(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) setCmdKeyHeld(false);
    };

    // Reset when window loses focus
    const handleBlur = () => setCmdKeyHeld(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return cmdKeyHeld;
}
