import type {
  ListComponentsResponse,
  PageLayout,
  StreamEvent,
} from '../types/index';
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
  layout: PageLayout
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/export-page`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pageName, layout }),
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
