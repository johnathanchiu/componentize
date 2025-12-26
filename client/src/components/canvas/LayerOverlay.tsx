import { useState, useEffect, type ComponentType } from 'react';
import { sharedStore } from '@/lib/sharedStore';
import { compileComponent } from '@/lib/componentRenderer';
import type { Layer } from '@/shared/types';

interface LayerOverlayProps {
  layer: Layer;
  projectId: string;
  stateKey: string;
}

export function LayerOverlay({ layer, projectId, stateKey }: LayerOverlayProps) {
  const [Component, setComponent] = useState<ComponentType<{ onClose?: () => void }> | null>(null);

  const componentName = layer.components[0];

  // Load the layer component
  useEffect(() => {
    if (!componentName) return;

    fetch(`/api/projects/${projectId}/components/${componentName}`)
      .then((res) => res.text())
      .then((source) => {
        const comp = compileComponent(source, componentName);
        setComponent(() => comp);
      })
      .catch((err) => console.error(`Failed to load layer component ${componentName}:`, err));
  }, [projectId, componentName]);

  const handleClose = () => {
    sharedStore.set(stateKey, false);
  };

  if (!Component) return null;

  // Render based on layer type
  switch (layer.type) {
    case 'modal':
      return (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleClose}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Component onClose={handleClose} />
          </div>
        </div>
      );

    case 'drawer':
      return (
        <div className="fixed inset-0 z-50 flex" onClick={handleClose}>
          {/* Backdrop */}
          <div className="flex-1 bg-black/30" />
          {/* Drawer panel - slides from right */}
          <div
            className="h-full bg-white shadow-2xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Component onClose={handleClose} />
          </div>
        </div>
      );

    case 'popover':
      // For now, render similar to modal but without backdrop darkening
      return (
        <div className="fixed inset-0 z-50" onClick={handleClose}>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Component onClose={handleClose} />
          </div>
        </div>
      );

    default:
      return null;
  }
}
