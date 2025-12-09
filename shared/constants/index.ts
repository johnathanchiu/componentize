// ============================================================================
// Shared Constants - Used by both frontend and backend
// ============================================================================

// API Configuration
export const DEFAULT_PORT = 5001;
export const API_VERSION = 'v1';

// AI Model Configuration
export const MODEL_NAME = 'claude-sonnet-4-5-20250929';
export const MAX_TOKENS = 4096;
export const MAX_ITERATIONS = 5;

// File Paths (relative to server directory)
export const COMPONENTS_DIR = '.components';
export const PAGES_DIR = '.pages';

// Component Constraints
export const MIN_COMPONENT_WIDTH = 100;
export const MIN_COMPONENT_HEIGHT = 60;
export const DEFAULT_COMPONENT_WIDTH = 200;
export const DEFAULT_COMPONENT_HEIGHT = 100;

// UI Timing
export const SUCCESS_MESSAGE_DURATION = 3000; // 3 seconds
export const DEBOUNCE_DELAY = 300; // 300ms

// Validation
export const MAX_COMPONENT_NAME_LENGTH = 50;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_PROMPT_LENGTH = 2000;

// Export
export const EXPORT_FILE_NAME_PREFIX = 'componentize-export';
export const PACKAGE_JSON_TEMPLATE = {
  name: 'componentize-export',
  version: '1.0.0',
  private: true,
  type: 'module',
  scripts: {
    'dev': 'vite',
    'build': 'tsc && vite build',
    'preview': 'vite preview'
  },
  dependencies: {
    'react': '^18.0.0',
    'react-dom': '^18.0.0',
    'typescript': '^5.0.0',
    '@types/react': '^18.0.0',
    '@types/react-dom': '^18.0.0'
  },
  devDependencies: {
    'tailwindcss': '^4.0.0',
    'vite': '^5.0.0',
    '@vitejs/plugin-react': '^4.0.0'
  }
};
