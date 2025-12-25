import type { PageLayout, StreamEvent } from '@/shared/types';
import type { Project } from '@/store/projectStore';
import type { ServerConversationMessage } from '@/store/generationStore';
import { config } from '@/config';

const API_BASE_URL = `${config.apiBaseUrl}/api`;

// ============================================
// Stream Utility
// ============================================

/**
 * Generic SSE stream reader - handles the common pattern of reading
 * Server-Sent Events from a fetch response.
 *
 * Fixed to properly handle multi-chunk messages by buffering incomplete
 * data and splitting on the SSE delimiter (\n\n)
 */
async function* readSSEStream(response: Response): AsyncGenerator<StreamEvent> {
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Append new chunk to buffer
    buffer += decoder.decode(value, { stream: true });

    // Split on SSE message delimiter (\n\n)
    const messages = buffer.split('\n\n');
    // Keep the last (potentially incomplete) message in the buffer
    buffer = messages.pop() || '';

    for (const message of messages) {
      // Skip empty messages and keepalive comments
      if (!message.trim() || message.startsWith(':')) continue;

      // Parse SSE message - look for "data: " prefix
      if (message.startsWith('data: ')) {
        try {
          const jsonStr = message.slice(6); // Remove "data: " prefix
          const parsed = JSON.parse(jsonStr);
          // Handle both wrapped {type, data} format and direct StreamEvent format
          if ('type' in parsed && typeof parsed.type === 'string') {
            yield parsed as StreamEvent;
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', message, e);
        }
      }
    }
  }

  // Process any remaining data in buffer
  if (buffer.trim() && buffer.startsWith('data: ')) {
    try {
      const jsonStr = buffer.slice(6);
      const parsed = JSON.parse(jsonStr);
      if ('type' in parsed && typeof parsed.type === 'string') {
        yield parsed as StreamEvent;
      }
    } catch (e) {
      // Ignore incomplete final message
    }
  }
}

/**
 * GET SSE stream from an endpoint
 */
async function* getSSEStream(url: string): AsyncGenerator<StreamEvent> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'text/event-stream' },
  });

  if (!response.ok) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  yield* readSSEStream(response);
}

// ============================================
// Streaming API Functions
// ============================================

/**
 * Check task status for a project
 */
export async function getTaskStatus(
  projectId: string
): Promise<{ status: 'idle' | 'running' | 'complete' | 'error'; eventCount: number; error: string | null }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/status`);
  if (!response.ok) {
    return { status: 'idle', eventCount: 0, error: null };
  }
  return response.json();
}

/**
 * Start a generation task and return stream URL
 */
export async function startGeneration(
  projectId: string,
  prompt: string
): Promise<{ status: string; projectId: string; streamUrl: string }> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start generation');
  }

  return response.json();
}

/**
 * Subscribe to SSE stream for a project (with optional resume from event N)
 */
export async function* subscribeToStream(
  projectId: string,
  since: number = 0
): AsyncGenerator<StreamEvent> {
  yield* getSSEStream(`${API_BASE_URL}/projects/${projectId}/stream?since=${since}`);
}

/**
 * Unified generation endpoint - handles creating and editing components
 * Uses new pattern: POST to start, then GET to stream
 */
export async function* generateStream(
  projectId: string,
  prompt: string
): AsyncGenerator<StreamEvent> {
  // Start generation (returns immediately)
  const { streamUrl } = await startGeneration(projectId, prompt);

  // Stream events from buffer
  yield* getSSEStream(`${API_BASE_URL}${streamUrl.replace('/api', '')}`);
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
  history: ServerConversationMessage[];
  taskStatus: 'idle' | 'running' | 'complete' | 'error';
  eventCount: number;
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
