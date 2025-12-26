import { useState, useMemo } from 'react';
import { layoutDef as landingLayout } from './generated/layout';
import { dashboardLayout } from './generated/layout-dashboard';
import { ecommerceLayout } from './generated/layout-ecommerce';
import { componentRegistry } from './generated/registry';
import { calculatePositions, type LayoutDef } from './layout-types';

const layouts: Record<string, LayoutDef> = {
  landing: landingLayout,
  dashboard: dashboardLayout,
  ecommerce: ecommerceLayout,
};

function App() {
  const [modalOpen, setModalOpen] = useState(false);

  // Get layout from URL param (default: landing)
  const layoutName = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('layout') || 'landing';
  }, []);

  const layoutDef = layouts[layoutName] || landingLayout;
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

      {/* Layout Switcher */}
      <div className="fixed bottom-4 right-4 z-50 flex gap-2">
        {Object.keys(layouts).map((name) => (
          <a
            key={name}
            href={`?layout=${name}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              layoutName === name
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-slate-600'
            }`}
          >
            {name.charAt(0).toUpperCase() + name.slice(1)}
          </a>
        ))}
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
