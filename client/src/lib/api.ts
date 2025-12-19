import type { PageLayout, StreamEvent } from '../types/index';
import type { Project } from '../store/projectStore';
import { config } from '../config';

const API_BASE_URL = `${config.apiBaseUrl}/api`;

// ============================================
// Stream Utility
// ============================================

/**
 * Generic SSE stream reader - handles the common pattern of reading
 * Server-Sent Events from a fetch response
 */
async function* readSSEStream(response: Response): AsyncGenerator<StreamEvent> {
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6)) as StreamEvent;
      }
    }
  }
}

/**
 * POST to an endpoint and stream SSE events
 */
async function* postAndStream(
  url: string,
  body: Record<string, unknown>
): AsyncGenerator<StreamEvent> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  yield* readSSEStream(response);
}

// ============================================
// Streaming API Functions
// ============================================

/**
 * Unified generation endpoint - handles creating and editing components
 */
export async function* generateStream(
  projectId: string,
  prompt: string
): AsyncGenerator<StreamEvent> {
  yield* postAndStream(`${API_BASE_URL}/projects/${projectId}/generate`, {
    prompt,
  });
}

/**
 * Edit component in a project with streaming progress
 */
export async function* editProjectComponentStream(
  projectId: string,
  componentName: string,
  editDescription: string
): AsyncGenerator<StreamEvent> {
  const editPrompt = `Edit the existing component "${componentName}": ${editDescription}`;
  yield* generateStream(projectId, editPrompt);
}

// ============================================
// Non-Streaming API Functions
// ============================================

export async function exportPageAsZip(
  pageName: string,
  layout: PageLayout,
  projectId: string
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageName, layout, projectId }),
  });

  if (!response.ok) {
    throw new Error('Failed to export page');
  }

  return response.blob();
}

/**
 * Get component code as plain text
 */
export async function getProjectComponentCode(
  projectId: string,
  componentName: string
): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/components/${componentName}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch component: ${componentName}`);
  }
  return response.text();
}

// ============================================
// Project API Functions
// ============================================

export async function createProject(
  name: string
): Promise<{ project: Project }> {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create project');
  }
  return response.json();
}

export async function listProjects(): Promise<{
  projects: Project[];
}> {
  const response = await fetch(`${API_BASE_URL}/projects`);
  if (!response.ok) {
    throw new Error('Failed to list projects');
  }
  return response.json();
}

export interface CanvasComponentData {
  id: string;
  componentName: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface ProjectResponse {
  project: Project;
  components: { name: string; filepath: string }[];
  canvas: CanvasComponentData[];
}

export async function getProject(id: string): Promise<ProjectResponse> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get project');
  }
  return response.json();
}

export async function deleteProject(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete project');
  }
  return response.json();
}

export async function deleteProjectComponent(
  projectId: string,
  componentName: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/components/${componentName}`,
    {
      method: 'DELETE',
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete component');
  }
  return response.json();
}

// ============================================
// Canvas API Functions
// ============================================

export async function saveProjectCanvas(
  projectId: string,
  components: CanvasComponentData[]
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/canvas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ components }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save canvas');
  }
  return response.json();
}
