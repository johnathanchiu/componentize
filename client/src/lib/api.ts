import type {
  ListComponentsResponse,
  PageLayout,
  StreamEvent,
} from '../types/index';
import type { Project } from '../store/projectStore';
import { config } from '../config';

const API_BASE_URL = `${config.apiBaseUrl}/api`;

/**
 * Generate component with streaming progress
 */
export async function* generateComponentStream(
  prompt: string,
  componentName: string
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_BASE_URL}/generate-component-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, componentName }),
  });

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

export async function listComponents(): Promise<ListComponentsResponse> {
  const response = await fetch(`${API_BASE_URL}/list-components`);
  return response.json();
}

/**
 * Export page as ZIP file
 */
export async function exportPageAsZip(
  pageName: string,
  layout: PageLayout,
  projectId: string
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/export-page`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pageName, layout, projectId }),
  });

  if (!response.ok) {
    throw new Error('Failed to export page');
  }

  return response.blob();
}

/**
 * Generate interaction with streaming progress
 */
export async function* generateInteractionStream(
  componentId: string,
  componentName: string,
  description: string,
  eventType: string
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_BASE_URL}/generate-interaction-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ componentId, componentName, description, eventType }),
  });

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
 * Edit component with streaming progress
 */
export async function* editComponentStream(
  componentName: string,
  editDescription: string
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_BASE_URL}/edit-component-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ componentName, editDescription }),
  });

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

export async function getComponentCode(componentName: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/get-component-code/${componentName}`);
  return response.json();
}

/**
 * Get component code in a project
 */
export async function getProjectComponentCode(projectId: string, componentName: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/components/${componentName}/code`);
  return response.json();
}

// ============================================
// Project API Functions
// ============================================

/**
 * Create a new project
 */
export async function createProject(name: string): Promise<{ status: string; project?: Project; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  return response.json();
}

/**
 * List all projects
 */
export async function listProjects(): Promise<{ status: string; projects: Project[] }> {
  const response = await fetch(`${API_BASE_URL}/projects`);
  return response.json();
}

/**
 * Get a specific project
 */
export async function getProject(id: string): Promise<{ status: string; project?: Project; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`);
  return response.json();
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
  });
  return response.json();
}

/**
 * List components in a project
 */
export async function listProjectComponents(projectId: string): Promise<ListComponentsResponse> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/components`);
  return response.json();
}

/**
 * Delete a component from a project
 */
export async function deleteProjectComponent(projectId: string, componentName: string): Promise<APIResponse> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/components/${componentName}`, {
    method: 'DELETE',
  });
  return response.json();
}

/**
 * Generate component in a project with streaming progress
 */
export async function* generateProjectComponentStream(
  projectId: string,
  prompt: string,
  componentName: string
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/generate-component-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, componentName }),
  });

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
 * Edit component in a project with streaming progress
 */
export async function* editProjectComponentStream(
  projectId: string,
  componentName: string,
  editDescription: string
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/edit-component-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ componentName, editDescription }),
  });

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

/**
 * Get canvas state for a project
 */
export async function getProjectCanvas(projectId: string): Promise<{ status: string; components: CanvasComponentData[] }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/canvas`);
  return response.json();
}

/**
 * Save canvas state for a project
 */
export async function saveProjectCanvas(projectId: string, components: CanvasComponentData[]): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/canvas`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ components }),
  });
  return response.json();
}
