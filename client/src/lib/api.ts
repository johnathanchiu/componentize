import type {
  APIResponse,
  PageLayout,
  StreamEvent,
} from '../types/index';
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
 * Agent decides whether to create 1 or multiple components based on request complexity
 */
export async function* generateStream(
  projectId: string,
  prompt: string
): AsyncGenerator<StreamEvent> {
  yield* postAndStream(`${API_BASE_URL}/projects/${projectId}/generate-stream`, {
    prompt,
  });
}

/**
 * Edit component in a project with streaming progress
 * Routes through the unified endpoint with an edit prompt
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
  const response = await fetch(`${API_BASE_URL}/export-page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageName, layout, projectId }),
  });

  if (!response.ok) {
    throw new Error('Failed to export page');
  }

  return response.blob();
}

export async function getProjectComponentCode(projectId: string, componentName: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/components/${componentName}`);
  return response.json();
}

// ============================================
// Project API Functions
// ============================================

export async function createProject(name: string): Promise<{ status: string; project?: Project; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return response.json();
}

export async function listProjects(): Promise<{ status: string; projects: Project[] }> {
  const response = await fetch(`${API_BASE_URL}/projects`);
  return response.json();
}

export interface ProjectResponse {
  status: string;
  project?: Project;
  components?: { name: string; filepath: string }[];
  canvas?: CanvasComponentData[];
  layouts?: LayoutDefinitionData[];
  message?: string;
}

export async function getProject(id: string): Promise<ProjectResponse> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`);
  return response.json();
}

export async function deleteProject(id: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function deleteProjectComponent(projectId: string, componentName: string): Promise<APIResponse> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/components/${componentName}`, {
    method: 'DELETE',
  });
  return response.json();
}

// ============================================
// Canvas API Functions
// ============================================

export interface CanvasComponentData {
  id: string;
  componentName: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  interactions?: any[];
}

export async function saveProjectCanvas(projectId: string, components: CanvasComponentData[]): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/canvas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ components }),
  });
  return response.json();
}

// ============================================
// Layout API Functions
// ============================================

export interface LayoutDefinitionData {
  name?: string;
  type: 'Stack' | 'Flex' | 'Grid' | 'Container';
  props?: Record<string, unknown>;
  children: Array<{ component: string; props?: Record<string, unknown> } | LayoutDefinitionData>;
}

export interface CanvasLayoutData {
  id: string;
  layoutName: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

export async function getProjectLayout(projectId: string, layoutName: string): Promise<{ status: string; layout?: LayoutDefinitionData; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/layouts/${layoutName}`);
  return response.json();
}

export async function createProjectLayout(projectId: string, name: string, layout: LayoutDefinitionData): Promise<{ status: string; layout_name?: string; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/layouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, layout }),
  });
  return response.json();
}

export async function updateProjectLayout(projectId: string, layoutName: string, layout: LayoutDefinitionData): Promise<{ status: string; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/layouts/${layoutName}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout }),
  });
  return response.json();
}

export async function deleteProjectLayout(projectId: string, layoutName: string): Promise<{ status: string; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/layouts/${layoutName}`, {
    method: 'DELETE',
  });
  return response.json();
}
