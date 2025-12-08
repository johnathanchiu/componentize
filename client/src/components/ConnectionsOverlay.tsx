import Xarrow, { Xwrapper } from 'react-xarrows';
import { memo, useMemo } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import {
  groupConnectionsByKey,
  generateConnectionColors,
  type StateConnection,
} from '../lib/sharedStore';
import { Link2, Link2Off } from 'lucide-react';

interface ConnectionsOverlayProps {
  connections: StateConnection[];
  visible: boolean;
}

/**
 * Renders visual connection lines between components that share state
 * Memoized to prevent re-renders when connections/visibility unchanged
 */
export const ConnectionsOverlay = memo(function ConnectionsOverlay({
  connections,
  visible,
}: ConnectionsOverlayProps) {
  // Memoize grouped connections and colors to avoid recalculation
  const { connectionsByKey, keys, colors } = useMemo(() => {
    if (!visible || connections.length === 0) {
      return { connectionsByKey: {}, keys: [], colors: [] };
    }
    const grouped = groupConnectionsByKey(connections);
    const stateKeys = Object.keys(grouped);
    return {
      connectionsByKey: grouped,
      keys: stateKeys,
      colors: generateConnectionColors(stateKeys.length),
    };
  }, [connections, visible]);

  if (!visible || connections.length === 0) return null;

  return (
    <Xwrapper>
      <div className="pointer-events-none absolute inset-0 z-40">
        {keys.map((stateKey, idx) => {
          const conns = connectionsByKey[stateKey];
          const color = colors[idx];

          // Find writers (components that can modify state)
          const writers = conns.filter(
            (c) => c.accessType === 'write' || c.accessType === 'both'
          );
          // Find readers (all components using this state - they all receive updates)
          const readers = conns.filter(
            (c) => c.accessType === 'read' || c.accessType === 'both'
          );

          // Draw lines from each writer to each reader (excluding self-connections)
          return writers.flatMap((writer) =>
            readers
              .filter((r) => r.componentId !== writer.componentId)
              .map((reader) => (
                <Xarrow
                  key={`${writer.componentId}-${reader.componentId}-${stateKey}`}
                  start={`connection-anchor-${writer.componentId}`}
                  end={`connection-anchor-${reader.componentId}`}
                  color={color}
                  strokeWidth={2}
                  path="smooth"
                  curveness={0.3}
                  showHead={true}
                  headSize={4}
                  animateDrawing={0.3}
                  labels={{
                    middle: (
                      <div
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium shadow-sm pointer-events-auto"
                        style={{ backgroundColor: color, color: 'white' }}
                      >
                        {stateKey}
                      </div>
                    ),
                  }}
                />
              ))
          );
        })}
      </div>
    </Xwrapper>
  );
});

/**
 * Toggle button for showing/hiding connections
 */
export function ConnectionsToggle() {
  const { showConnections, toggleShowConnections, stateConnections } = useCanvasStore();
  const hasConnections = stateConnections.length > 0;

  if (!hasConnections) return null;

  return (
    <button
      onClick={toggleShowConnections}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
        showConnections
          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
      }`}
      title={showConnections ? 'Hide state connections' : 'Show state connections'}
    >
      {showConnections ? (
        <>
          <Link2 className="w-3.5 h-3.5" />
          <span>Hide Connections</span>
        </>
      ) : (
        <>
          <Link2Off className="w-3.5 h-3.5" />
          <span>Show Connections</span>
        </>
      )}
    </button>
  );
}

/**
 * Legend showing what each connection color represents
 */
export function ConnectionsLegend() {
  const { showConnections, stateConnections } = useCanvasStore();

  if (!showConnections || stateConnections.length === 0) return null;

  const connectionsByKey = groupConnectionsByKey(stateConnections);
  const keys = Object.keys(connectionsByKey);
  const colors = generateConnectionColors(keys.length);

  return (
    <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm border border-neutral-200 rounded-lg shadow-lg p-3 z-50">
      <div className="text-xs font-semibold text-neutral-700 mb-2">Shared State</div>
      <div className="space-y-1.5">
        {keys.map((key, idx) => {
          const conns = connectionsByKey[key];
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[idx] }}
              />
              <span className="font-mono text-neutral-600">{key}</span>
              <span className="text-neutral-400">({conns.length} components)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
