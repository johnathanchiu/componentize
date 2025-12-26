import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error) => void;
  /** Optional fallback UI to show on error. If not provided, returns null */
  fallback?: React.ReactNode;
  /** When this key changes, the error state resets (for retrying after fixes) */
  resetKey?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error boundary for React components.
 * Can be used with a fallback UI or to silently catch errors and delegate to parent.
 */
export class ComponentErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when resetKey changes (component reloaded)
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
