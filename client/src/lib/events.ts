import mitt from 'mitt';
import type { CanvasComponent } from '../types/index';

/**
 * Event types for cross-feature communication.
 * Features don't import each other's stores - they communicate via events.
 */
export type AppEvents = {
  // Canvas events
  'canvas:component-added': CanvasComponent;
  'canvas:component-removed': string;
  'canvas:component-selected': string | null;
  'canvas:cleared': void;

  // Generation events
  'generation:started': { mode: 'create' | 'edit' | 'fix'; target?: string };
  'generation:completed': void;
  'generation:error': { message: string };

  // Library events
  'library:refreshed': void;
  'library:component-deleted': string;

  // Project events
  'project:selected': string | null;
  'project:created': string;
  'project:deleted': string;

  // Error events
  'error:component-render': { componentName: string; error: Error };
};

/**
 * Global event bus instance.
 * Use this to emit and listen for events across features.
 */
export const events = mitt<AppEvents>();

/**
 * Convenience function to emit an event.
 */
export function emit<K extends keyof AppEvents>(type: K, data: AppEvents[K]): void {
  events.emit(type, data);
}

/**
 * Convenience function to listen for an event.
 * Returns an unsubscribe function.
 */
export function on<K extends keyof AppEvents>(
  type: K,
  handler: (data: AppEvents[K]) => void
): () => void {
  events.on(type, handler);
  return () => events.off(type, handler);
}

/**
 * Listen for an event only once.
 */
export function once<K extends keyof AppEvents>(
  type: K,
  handler: (data: AppEvents[K]) => void
): () => void {
  const wrapper = (data: AppEvents[K]) => {
    events.off(type, wrapper);
    handler(data);
  };
  events.on(type, wrapper);
  return () => events.off(type, wrapper);
}
