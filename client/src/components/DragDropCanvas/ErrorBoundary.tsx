import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError: (error: Error) => void;
  resetKey?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ComponentErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when resetKey changes (component reloaded)
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return null; // Error overlay will be shown by parent
    }
    return this.props.children;
  }
}
