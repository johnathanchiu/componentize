import path from 'path';

/**
 * Workspace configuration for storing generated components.
 * The workspace is a directory containing project folders with component files.
 */
const WORKSPACE_PATH = path.resolve(__dirname, '../../.workspace');

/**
 * Get the workspace path where projects and components are stored
 */
export function getWorkspacePath(): string {
  return WORKSPACE_PATH;
}
