import { useState, useEffect, useRef, type ComponentType } from 'react';
import { Trash2, Wrench } from 'lucide-react';
import { useGenerationStore } from '@/store/generationStore';
import { loadComponent } from '@/lib/componentRenderer';
import { ComponentErrorBoundary } from '@/components/canvas/ErrorBoundary';
import type { Size } from '@/shared/types';

interface ComponentCardProps {
  name: string;
  projectId: string;
  onDelete: () => void;
  onError?: (componentName: string, error: string) => void;
  onSuccess?: (componentName: string) => void;
}

export function ComponentCard({ name, projectId, onDelete, onError, onSuccess }: ComponentCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  // Use selectors to prevent unnecessary re-renders
  const startFixing = useGenerationStore((s) => s.startFixing);
  const componentVersion = useGenerationStore((s) => s.componentVersions[name] || 0);
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  // Load component when projectId, name, or version changes
  useEffect(() => {
    setLoading(true);
    setNaturalSize(null);
    setRenderError(null);
    loadComponent(projectId, name)
      .then((comp) => {
        setComponent(() => comp);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load component for preview:', err);
        setLoading(false);
        onError?.(name, err.message || 'Failed to load component');
      });
  }, [projectId, name, componentVersion, onError]);

  // Report render errors to parent
  const reportedErrorRef = useRef<string | null>(null);
  const reportedSuccessRef = useRef(false);

  useEffect(() => {
    if (renderError && renderError !== reportedErrorRef.current) {
      reportedErrorRef.current = renderError;
      reportedSuccessRef.current = false;
      onError?.(name, renderError);
    } else if (!loading && Component && !renderError && !reportedSuccessRef.current) {
      reportedSuccessRef.current = true;
      reportedErrorRef.current = null;
      onSuccess?.(name);
    }
  }, [renderError, loading, Component, name, onError, onSuccess]);

  // Measure component's natural size
  useEffect(() => {
    if (!Component || !componentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setNaturalSize({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });

    observer.observe(componentRef.current);
    return () => observer.disconnect();
  }, [Component]);

  // Calculate scale to fit within bounds
  const maxWidth = 220;
  const maxHeight = 100;
  const scale = naturalSize
    ? Math.min(maxWidth / naturalSize.width, maxHeight / naturalSize.height, 1)
    : 1;

  // Drag handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/componentName', name);
    e.dataTransfer.effectAllowed = 'move';

    const dragImage = document.createElement('div');
    dragImage.textContent = name;
    dragImage.style.cssText =
      'padding: 8px 16px; background: white; border: 2px solid #171717; border-radius: 8px; font-size: 14px; font-weight: 500; position: absolute; top: -1000px; left: -1000px;';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);
    setTimeout(() => document.body.removeChild(dragImage), 0);

    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group/card relative rounded-lg border border-neutral-200 overflow-hidden cursor-grab active:cursor-grabbing hover:border-neutral-300 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDelete();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1 right-1 z-10 p-1.5 rounded bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover/card:opacity-100 transition-opacity shadow-sm"
        title="Delete component"
      >
        <Trash2 className="w-3 h-3" />
      </button>

      {/* Preview container */}
      <div
        className="bg-neutral-50 pointer-events-none flex items-center justify-center overflow-hidden"
        style={{ minHeight: 50, padding: 8 }}
      >
        {loading && <div className="text-xs text-neutral-400">Loading...</div>}
        {!loading && renderError && (
          <div className="text-xs text-red-500 text-center px-2 pointer-events-auto">
            <div className="font-medium">Render error</div>
            <div className="text-red-400 truncate" title={renderError}>
              {renderError}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                startFixing(name, { message: renderError });
              }}
              className="mt-1.5 px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium transition-colors"
            >
              <Wrench className="w-3 h-3 inline mr-1" />
              Fix
            </button>
          </div>
        )}
        {!loading && !renderError && Component && (
          <ComponentErrorBoundary
            fallback={
              <div className="text-xs text-red-500 text-center px-2 pointer-events-auto">
                <div className="font-medium">Component crashed</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startFixing(name, { message: 'Component crashed during render' });
                  }}
                  className="mt-1.5 px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium transition-colors"
                >
                  <Wrench className="w-3 h-3 inline mr-1" />
                  Fix
                </button>
              </div>
            }
            onError={(err) => setRenderError(err.message)}
          >
            <div
              ref={componentRef}
              className="inline-block"
              style={{
                transformOrigin: 'center',
                transform: scale !== 1 ? `scale(${scale})` : undefined,
              }}
            >
              <Component />
            </div>
          </ComponentErrorBoundary>
        )}
      </div>

      {/* Component name */}
      <div className="px-3 py-2 bg-white border-t border-neutral-100">
        <span className="text-sm font-medium text-neutral-900">{name}</span>
      </div>
    </div>
  );
}
