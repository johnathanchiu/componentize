# Componentize Architecture

## Overview

Componentize is a visual React component builder with AI-powered generation. Users create projects, generate components via prompts, and arrange them on a canvas.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  LeftPanel  │  │   Canvas    │  │    CodePreview      │  │
│  │  - Create   │  │  - ReactFlow│  │    - View code      │  │
│  │  - Library  │  │  - Drag/Drop│  │    - Edit mode      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                 │
│                    Zustand Stores                           │
│         (canvasStore, projectStore, generationStore)        │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP/SSE
┌────────────────────────────┴────────────────────────────────┐
│                       Server (Fastify)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Routes    │  │   Agents    │  │     Services        │  │
│  │  /api/*     │──│  Component  │──│  - fileService      │  │
│  │             │  │             │  │  - projectService   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                 │
│                    Anthropic Claude API                     │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
componentize/
├── client/                    # React frontend
│   └── src/
│       ├── components/
│       │   ├── LeftPanel.tsx           # Create form + component library
│       │   ├── DragDropCanvas/         # React Flow canvas
│       │   │   ├── index.tsx           # Main canvas with ReactFlowProvider
│       │   │   ├── ComponentNode.tsx   # Individual node renderer
│       │   │   ├── ErrorBoundary.tsx
│       │   │   └── ErrorOverlay.tsx
│       │   ├── projects/
│       │   │   └── ProjectsPage.tsx    # Landing page with prompt input
│       │   ├── page-generation/        # Page generation UI
│       │   │   ├── GeneratePageButton.tsx
│       │   │   ├── GeneratePageModal.tsx
│       │   │   └── PageGenerationOverlay.tsx
│       │   ├── Timeline.tsx            # Streaming events display
│       │   ├── TimelineEvent.tsx       # Individual event renderer
│       │   ├── CodePreviewPanel.tsx
│       │   └── ...
│       ├── store/
│       │   ├── canvasStore.ts          # Canvas items, positions, sizes
│       │   ├── generationStore.ts      # AI generation + page generation state
│       │   └── projectStore.ts         # Project metadata + available components
│       ├── lib/
│       │   ├── api.ts                  # API client + SSE streaming
│       │   ├── componentRenderer.ts    # Runtime JSX compilation
│       │   └── sharedStore.ts          # Cross-component state sharing
│       └── hooks/
│           ├── useCmdKey.ts
│           └── useResizablePanel.ts
│
├── server/                    # Fastify backend
│   └── src/
│       ├── server.ts
│       ├── routes/
│       │   ├── projects.ts             # Project CRUD
│       │   ├── generation.ts           # SSE generation endpoint
│       │   ├── components.ts           # Component CRUD
│       │   ├── canvas.ts               # Canvas persistence
│       │   └── export.ts               # ZIP export
│       ├── agents/
│       │   ├── base.ts                 # Streaming loop, tool execution
│       │   └── component/              # Component generation agent
│       │       ├── index.ts
│       │       ├── tools.ts
│       │       ├── handlers.ts
│       │       └── prompt.ts
│       └── services/
│           ├── fileService.ts          # Component file CRUD
│           ├── projectService.ts       # Project + history management
│           └── exportService.ts        # ZIP export
│
└── ARCHITECTURE.md
```

## Data Flow

### 1. Component Generation

```
User prompt → LeftPanel → api.generateStream()
                              ↓ (SSE)
                         Server route
                              ↓
                      ComponentAgent.generate()
                              ↓
                      Claude API (streaming)
                              ↓
                      Tool calls: create_component, update_component
                              ↓
                      fileService.createComponent()
                              ↓ (events)
                         Client receives
                              ↓
                      generationStore.addStreamingEvent()
                      canvasStore.addToCanvas()
```

### 2. Canvas Persistence

```
User drags component → onNodesChange → updatePosition()
                                            ↓
                                   canvasStore (Zustand)
                                            ↓
                                   debouncedSave (500ms)
                                            ↓
                                   api.saveProjectCanvas()
                                            ↓
                                   Server: projectService.saveCanvas()
```

### 3. Component Rendering (Runtime Compilation)

Components are compiled and executed at runtime in the browser:

```
ComponentNode mounts → fetch `/api/projects/{id}/components/{name}`
                            ↓
                       componentRenderer.loadComponent()
                            ↓
                       prepareSource() - strip imports/exports
                            ↓
                       sucrase.transform() - JSX/TS → JS
                            ↓
                       new Function(...scopeKeys, code)
                            ↓
                       fn(...scopeValues) → React component
                            ↓
                       Render in ComponentNode with error boundary
```

## Key Files

| File | Purpose |
|------|---------|
| `client/src/lib/api.ts` | All API calls, SSE streaming utility |
| `client/src/store/canvasStore.ts` | Canvas state: items, positions, sizes |
| `client/src/store/generationStore.ts` | Generation state: streaming, status, page gen |
| `client/src/store/projectStore.ts` | Project metadata + available components |
| `client/src/components/DragDropCanvas/index.tsx` | React Flow canvas |
| `client/src/components/LeftPanel.tsx` | Create tab + Library tab |
| `server/src/agents/component/index.ts` | Component generation agent |
| `server/src/services/projectService.ts` | Project + history persistence |

## Streaming Pattern

All generation endpoints use Server-Sent Events (SSE):

```typescript
// Client (api.ts)
async function* postAndStream(url, body) {
  const response = await fetch(url, { method: 'POST', body });
  const reader = response.body.getReader();
  // ... yield JSON events
}

// Server (base.ts)
async *runAgentLoop() {
  const stream = client.messages.stream({ ... });
  for await (const event of stream) {
    yield { type: 'thinking', message: ... };
    yield { type: 'tool_result', ... };
  }
}
```

## State Management

Three Zustand stores with clear separation:

1. **canvasStore** - Canvas items, positions, sizes, selection
2. **generationStore** - AI generation state: streaming events, status, page generation
3. **projectStore** - Current project metadata + available components list

## Component Scope (Sandboxed Environment)

Generated components run in a sandboxed environment with `COMPONENT_SCOPE`:

```typescript
const COMPONENT_SCOPE = {
  // React core
  React, useState, useEffect, useRef, useCallback, useMemo,

  // Cross-component state
  useSharedState,

  // shadcn/ui components
  Button, Card, Input, Dialog, Select, Tabs, ...

  // Lucide icons (100+)
  ArrowRight, Check, Heart, Home, Search, ...
};
```

**Available:** React hooks, shadcn/ui, Lucide icons, useSharedState
**Not available:** fetch, localStorage, DOM APIs, external packages
