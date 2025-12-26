import { useState } from 'react';
import { layoutDef } from './generated/layout';
import { componentRegistry } from './generated/registry';
import { calculatePositions } from './layout-types';

function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const positions = calculatePositions(layoutDef);

  // Calculate total page height
  let maxY = 0;
  positions.forEach(pos => {
    maxY = Math.max(maxY, pos.y + pos.height);
  });
  const pageHeight = maxY + 100;

  return (
    <div
      className="min-h-screen"
      style={{ background: layoutDef.pageStyle.background }}
    >
      {/* Page container */}
      <div
        className="relative mx-auto"
        style={{
          width: layoutDef.pageStyle.width,
          height: pageHeight,
        }}
      >
        {/* Render all components at calculated positions */}
        {Array.from(positions.entries()).map(([name, pos]) => {
          const Component = componentRegistry[name];
          if (!Component) return null;

          return (
            <div
              key={name}
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                width: pos.width,
                height: pos.height,
              }}
              onClick={() => {
                // Handle modal triggers
                if (name === 'SignupBtn' || name === 'HeroCTA') {
                  setModalOpen(true);
                }
              }}
            >
              <Component />
            </div>
          );
        })}
      </div>

      {/* Modal layer */}
      {modalOpen && layoutDef.layers.length > 0 && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setModalOpen(false)}
        >
          <div onClick={e => e.stopPropagation()}>
            {layoutDef.layers[0].components.map(name => {
              const Component = componentRegistry[name];
              if (!Component) return null;
              return (
                <div key={name} style={{ width: 400, height: 420 }}>
                  <Component onClose={() => setModalOpen(false)} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
