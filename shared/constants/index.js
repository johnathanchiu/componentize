"use strict";
// ============================================================================
// Shared Constants - Used by both frontend and backend
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKAGE_JSON_TEMPLATE = exports.EXPORT_FILE_NAME_PREFIX = exports.MAX_PROMPT_LENGTH = exports.MAX_DESCRIPTION_LENGTH = exports.MAX_COMPONENT_NAME_LENGTH = exports.DEBOUNCE_DELAY = exports.SUCCESS_MESSAGE_DURATION = exports.DEFAULT_COMPONENT_HEIGHT = exports.DEFAULT_COMPONENT_WIDTH = exports.MIN_COMPONENT_HEIGHT = exports.MIN_COMPONENT_WIDTH = exports.PAGES_DIR = exports.COMPONENTS_DIR = exports.GENERATED_DIR = exports.MAX_ITERATIONS = exports.MAX_TOKENS = exports.MODEL_NAME = exports.API_VERSION = exports.DEFAULT_PORT = void 0;
// API Configuration
exports.DEFAULT_PORT = 5001;
exports.API_VERSION = 'v1';
// AI Model Configuration
exports.MODEL_NAME = 'claude-sonnet-4-5-20250929';
exports.MAX_TOKENS = 4096;
exports.MAX_ITERATIONS = 5;
// File Paths (relative to project root)
exports.GENERATED_DIR = 'generated';
exports.COMPONENTS_DIR = 'generated/components';
exports.PAGES_DIR = 'generated/pages';
// Component Constraints
exports.MIN_COMPONENT_WIDTH = 100;
exports.MIN_COMPONENT_HEIGHT = 60;
exports.DEFAULT_COMPONENT_WIDTH = 200;
exports.DEFAULT_COMPONENT_HEIGHT = 100;
// UI Timing
exports.SUCCESS_MESSAGE_DURATION = 3000; // 3 seconds
exports.DEBOUNCE_DELAY = 300; // 300ms
// Validation
exports.MAX_COMPONENT_NAME_LENGTH = 50;
exports.MAX_DESCRIPTION_LENGTH = 1000;
exports.MAX_PROMPT_LENGTH = 2000;
// Export
exports.EXPORT_FILE_NAME_PREFIX = 'componentize-export';
exports.PACKAGE_JSON_TEMPLATE = {
    name: 'componentize-export',
    version: '1.0.0',
    private: true,
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
//# sourceMappingURL=index.js.map