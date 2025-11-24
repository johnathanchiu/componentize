import type {
  GenerateComponentResponse,
  ListComponentsResponse,
  ExportPageResponse,
  GenerateInteractionResponse,
  PageLayout,
} from '../types/index';

const API_BASE_URL = 'http://localhost:5001/api';

export async function generateComponent(
  prompt: string,
  componentName: string
): Promise<GenerateComponentResponse> {
  const response = await fetch(`${API_BASE_URL}/generate-component`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, componentName }),
  });

  return response.json();
}

export async function listComponents(): Promise<ListComponentsResponse> {
  const response = await fetch(`${API_BASE_URL}/list-components`);
  return response.json();
}

export async function exportPage(
  pageName: string,
  layout: PageLayout
): Promise<ExportPageResponse> {
  const response = await fetch(`${API_BASE_URL}/export-page`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pageName, layout }),
  });

  return response.json();
}

export async function generateInteraction(
  componentId: string,
  componentName: string,
  description: string,
  eventType: string
): Promise<GenerateInteractionResponse> {
  const response = await fetch(`${API_BASE_URL}/generate-interaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ componentId, componentName, description, eventType }),
  });

  return response.json();
}

export async function editComponent(
  componentName: string,
  editDescription: string
): Promise<APIResponse> {
  const response = await fetch(`${API_BASE_URL}/edit-component`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ componentName, editDescription }),
  });

  return response.json();
}

export async function getComponentCode(componentName: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/get-component-code/${componentName}`);
  return response.json();
}
