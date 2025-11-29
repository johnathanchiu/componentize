import { fileService } from './fileService';

export class PreviewService {
  /**
   * Clean component code for browser use (remove imports/exports)
   */
  private cleanComponentCode(code: string): string {
    let cleaned = code;

    // Remove import statements
    cleaned = cleaned.replace(/^import\s+.*?;?\s*$/gm, '');

    // Remove export default
    cleaned = cleaned.replace(/^export\s+default\s+/gm, '');

    return cleaned.trim();
  }

  /**
   * Generate preview HTML for a component
   */
  async generatePreviewHTML(componentName: string): Promise<string | null> {
    // Read component
    const result = await fileService.readComponent(componentName);

    if (result.status !== 'success' || !result.content) {
      return null;
    }

    const cleanedCode = this.cleanComponentCode(result.content);

    // Generate HTML
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${componentName} Preview</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script>
        // Error handler - send errors to parent window
        window.addEventListener('error', function(event) {
            if (window.parent) {
                window.parent.postMessage({
                    type: 'COMPONENT_ERROR',
                    componentName: '${componentName}',
                    error: {
                        message: event.message,
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno,
                        stack: event.error ? event.error.stack : ''
                    }
                }, '*');
            }
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', function(event) {
            if (window.parent) {
                window.parent.postMessage({
                    type: 'COMPONENT_ERROR',
                    componentName: '${componentName}',
                    error: {
                        message: event.reason ? event.reason.message : 'Unhandled promise rejection',
                        stack: event.reason ? event.reason.stack : ''
                    }
                }, '*');
            }
        });
    </script>
    <script>
        // Register TSX preset for TypeScript + React support
        Babel.registerPreset('tsx', {
            presets: [
                [Babel.availablePresets['typescript'], { allExtensions: true, isTSX: true }],
                [Babel.availablePresets['react']]
            ]
        });
    </script>
    <script type="text/babel" data-presets="tsx">
        try {
            const { useState, useEffect, useRef, useCallback, useMemo, useContext, useReducer } = React;

            ${cleanedCode}

            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement(${componentName}));

            // Notify parent that component loaded successfully
            if (window.parent) {
                window.parent.postMessage({
                    type: 'COMPONENT_LOADED',
                    componentName: '${componentName}'
                }, '*');
            }
        } catch (error) {
            console.error('Component render error:', error);
            if (window.parent) {
                window.parent.postMessage({
                    type: 'COMPONENT_ERROR',
                    componentName: '${componentName}',
                    error: {
                        message: error.message,
                        stack: error.stack
                    }
                }, '*');
            }
        }
    </script>
</body>
</html>`;
  }
}

// Export singleton instance
export const previewService = new PreviewService();
