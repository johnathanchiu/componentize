/**
 * AIComponent Renderer - Renders full React components with runtime compilation
 * This is the special block type that allows AI-generated interactive components
 */
import React, { useState, useEffect, useMemo } from 'react';
import type { AIComponentBlock } from '../../../../shared/types';
import { compileComponent } from '@/lib/componentRenderer';

interface AIComponentRendererProps {
  block: AIComponentBlock;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

interface ErrorState {
  message: string;
  stack?: string;
}

/**
 * Error boundary for catching runtime errors in AI components
 */
class AIComponentErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { error: ErrorState | null }
> {
  constructor(props: { children: React.ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): { error: ErrorState } {
    return {
      error: {
        message: error.message,
        stack: error.stack,
      },
    };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Runtime Error
          </div>
          <pre className="text-sm text-red-600 whitespace-pre-wrap font-mono">
            {this.state.error.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * AIComponent Renderer
 * Compiles and renders AI-generated React component code
 */
export const AIComponentRenderer: React.FC<AIComponentRendererProps> = ({
  block,
  isSelected,
  onClick,
}) => {
  const [compilationError, setCompilationError] = useState<string | null>(null);

  // Compile the component from code
  const CompiledComponent = useMemo(() => {
    if (!block.code) {
      return null;
    }

    try {
      setCompilationError(null);
      return compileComponent(block.code, block.componentName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown compilation error';
      setCompilationError(message);
      console.error('AIComponent compilation error:', error);
      return null;
    }
  }, [block.code, block.componentName]);

  // Show compilation error
  if (compilationError) {
    return (
      <div
        className={`p-4 bg-amber-50 border border-amber-200 rounded-lg ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
        onClick={onClick}
      >
        <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Compilation Error
        </div>
        <pre className="text-sm text-amber-600 whitespace-pre-wrap font-mono">
          {compilationError}
        </pre>
        <div className="mt-2 text-xs text-amber-500">
          Component: {block.componentName || 'Unknown'}
        </div>
      </div>
    );
  }

  // No code
  if (!CompiledComponent) {
    return (
      <div
        className={`p-4 bg-gray-50 border border-gray-200 rounded-lg ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
        onClick={onClick}
      >
        <div className="text-gray-500 text-sm">
          Empty AIComponent: {block.componentName || 'Unknown'}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={onClick}
    >
      <AIComponentErrorBoundary>
        <CompiledComponent />
      </AIComponentErrorBoundary>
    </div>
  );
};

export default AIComponentRenderer;
