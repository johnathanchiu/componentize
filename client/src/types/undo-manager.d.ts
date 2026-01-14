declare module 'undo-manager' {
  interface UndoManagerOptions {
    limit?: number;
  }

  class UndoManager {
    constructor(options?: UndoManagerOptions);
    add(operation: { undo: () => void; redo: () => void }): void;
    undo(): void;
    redo(): void;
    clear(): void;
    hasUndo(): boolean;
    hasRedo(): boolean;
    getIndex(): number;
    getCommands(): Array<{ undo: () => void; redo: () => void }>;
    setCallback(callback: () => void): void;
    setLimit(limit: number): void;
  }

  export default UndoManager;
}
