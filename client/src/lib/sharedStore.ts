import { useState, useEffect, useCallback } from 'react';

type Listener = (value: unknown) => void;

/**
 * Reactive store for sharing state between components on the canvas.
 * Similar to Zustand but simpler - key-value based with subscriptions.
 */
class SharedStore {
  private state: Record<string, unknown> = {};
  private listeners: Map<string, Set<Listener>> = new Map();
  private globalListeners: Set<() => void> = new Set();

  /**
   * Get a value from the store
   * Uses explicit undefined check to properly handle falsy values (0, false, '')
   */
  get<T>(key: string, defaultValue?: T): T {
    const value = this.state[key];
    return value !== undefined ? (value as T) : (defaultValue as T);
  }

  /**
   * Check if a key exists in the store
   */
  has(key: string): boolean {
    return key in this.state;
  }

  /**
   * Set a value in the store and notify subscribers
   * Uses deep equality for objects to avoid unnecessary re-renders
   */
  set<T>(key: string, value: T): void {
    const oldValue = this.state[key];

    // Skip if values are identical (reference equality)
    if (oldValue === value) return;

    // Deep equality check for objects/arrays to avoid unnecessary updates
    if (
      typeof oldValue === 'object' &&
      typeof value === 'object' &&
      oldValue !== null &&
      value !== null
    ) {
      try {
        if (JSON.stringify(oldValue) === JSON.stringify(value)) return;
      } catch {
        // JSON.stringify failed (circular reference, etc.) - proceed with update
      }
    }

    this.state[key] = value;
    this.listeners.get(key)?.forEach((fn) => fn(value));
    this.globalListeners.forEach((fn) => fn());
  }

  /**
   * Subscribe to changes on a specific key
   */
  subscribe(key: string, listener: Listener): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    return () => this.listeners.get(key)?.delete(listener);
  }

  /**
   * Subscribe to any change in the store
   */
  subscribeAll(listener: () => void): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  /**
   * Get a snapshot of the entire store
   */
  getSnapshot(): Record<string, unknown> {
    return { ...this.state };
  }

  /**
   * Get all keys that have values
   */
  getKeys(): string[] {
    return Object.keys(this.state);
  }

  /**
   * Clear all state (useful for resetting between projects)
   */
  clear(): void {
    this.state = {};
    this.globalListeners.forEach((fn) => fn());
  }
}

// Singleton instance
export const sharedStore = new SharedStore();

/**
 * React hook for using shared state between components.
 *
 * Usage:
 *   const [count, setCount] = useSharedState('counter', 0);
 *
 * Any component using the same key will share and sync state.
 */
export function useSharedState<T>(key: string, defaultValue?: T): [T, (value: T) => void] {
  // Initialize synchronously in useState to avoid race conditions
  // when multiple components mount with the same key
  const [value, setValue] = useState<T>(() => {
    if (sharedStore.has(key)) {
      return sharedStore.get<T>(key)!;
    }
    if (defaultValue !== undefined) {
      sharedStore.set(key, defaultValue);
    }
    return defaultValue as T;
  });

  useEffect(() => {
    // Subscribe to changes (initialization already handled in useState)
    return sharedStore.subscribe(key, (newValue) => {
      setValue(newValue as T);
    });
  }, [key]); // Removed defaultValue - initialization is sync in useState

  const setSharedValue = useCallback(
    (newValue: T) => {
      sharedStore.set(key, newValue);
    },
    [key]
  );

  return [value, setSharedValue];
}

/**
 * Hook to get a snapshot of the entire shared store (for debugging/state panel)
 */
export function useSharedStoreSnapshot(): Record<string, unknown> {
  const [snapshot, setSnapshot] = useState(() => sharedStore.getSnapshot());

  useEffect(() => {
    return sharedStore.subscribeAll(() => {
      setSnapshot(sharedStore.getSnapshot());
    });
  }, []);

  return snapshot;
}

// ============================================================================
// Connection Detection
// ============================================================================

export interface StateConnection {
  componentId: string;
  componentName: string;
  stateKey: string;
  accessType: 'read' | 'write' | 'both';
}

/**
 * Parse component source code to detect useSharedState usage
 */
export function detectStateConnections(
  source: string,
  componentId: string,
  componentName: string
): StateConnection[] {
  const connections: StateConnection[] = [];

  // Match useSharedState('key', ...) or useSharedState<Type>('key', ...)
  const regex = /useSharedState\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const stateKey = match[1];

    // Check if the component destructures the setter (second element)
    // Pattern: const [value, setValue] = useSharedState(...)
    const hasDestructuredSetter = new RegExp(
      `\\[\\s*\\w+\\s*,\\s*\\w+\\s*\\]\\s*=\\s*useSharedState\\s*(?:<[^>]*>)?\\s*\\(\\s*['"]${stateKey}['"]`
    ).test(source);

    // Check for single value destructuring: const [value] = useSharedState(...)
    const readOnly = new RegExp(
      `\\[\\s*\\w+\\s*\\]\\s*=\\s*useSharedState\\s*(?:<[^>]*>)?\\s*\\(\\s*['"]${stateKey}['"]`
    ).test(source);

    connections.push({
      componentId,
      componentName,
      stateKey,
      accessType: readOnly ? 'read' : hasDestructuredSetter ? 'both' : 'read',
    });
  }

  return connections;
}

/**
 * Group connections by state key for easier visualization
 */
export function groupConnectionsByKey(
  connections: StateConnection[]
): Record<string, StateConnection[]> {
  return connections.reduce(
    (acc, conn) => {
      if (!acc[conn.stateKey]) {
        acc[conn.stateKey] = [];
      }
      acc[conn.stateKey].push(conn);
      return acc;
    },
    {} as Record<string, StateConnection[]>
  );
}

/**
 * Generate a color palette for connection visualization
 */
export function generateConnectionColors(count: number): string[] {
  const baseColors = [
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#EF4444', // Red
    '#EC4899', // Pink
    '#3B82F6', // Blue
    '#84CC16', // Lime
  ];

  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  // Generate more colors if needed
  const colors = [...baseColors];
  for (let i = baseColors.length; i < count; i++) {
    const hue = (i * 137.5) % 360; // Golden angle for good distribution
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
}
