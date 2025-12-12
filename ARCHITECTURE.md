# Componentize Architecture

## Overview

Componentize is a visual React component builder with AI-powered generation. Users create projects, generate components via prompts, and arrange them on a canvas.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  LeftPanel  │  │   Canvas    │  │    CodePreview      │  │
│  │  - Create   │  │  - Items    │  │    - View code      │  │
│  │  - Library  │  │  - Drag/Drop│  │    - Edit mode      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                 │
│                    Zustand Stores                           │
│         (canvasStore, projectStore, pageGenerationStore)    │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP/SSE
┌────────────────────────────┴────────────────────────────────┐
│                       Server (Fastify)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Routes    │  │   Agents    │  │     Services        │  │
│  │  /api/*     │──│  Component  │──│  - fileService      │  │
│  │             │  │  Interaction│  │  - projectService   │  │
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
│       ├── components/        # UI components
│       │   ├── LeftPanel.tsx      # Create form + component library
│       │   ├── DragDropCanvas.tsx # Canvas with draggable items
│       │   ├── InteractionPanel.tsx
│       │   └── ...
│       ├── store/             # Zustand state management
│       │   ├── canvasStore.ts         # Canvas items, positions, connections
│       │   ├── generationStore.ts     # AI generation, streaming state
│       │   ├── componentLibraryStore.ts # Available components
│       │   └── projectStore.ts        # Current project
│       └── lib/
│           ├── api.ts             # API client + SSE streaming
│           ├── componentRenderer.ts # Runtime JSX compilation
│           └── sharedStore.ts     # Cross-component state sharing
│
├── server/                    # Fastify backend
│   └── src/
│       ├── server.ts          # Route definitions
│       ├── agents/            # Claude-powered agents
│       │   ├── baseAgent.ts       # Streaming loop, tool execution
│       │   ├── componentAgent.ts  # Component generation
│       │   └── interactionAgent.ts
│       └── services/
│           ├── fileService.ts     # Component file CRUD
│           ├── projectService.ts  # Project management
│           └── exportService.ts   # ZIP export
│
└── shared/                    # Shared types
    └── types.ts
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
                      Tool calls: create_component
                              ↓
                      fileService.createComponent()
                              ↓ (events)
                         Client receives
                              ↓
                      canvasStore.addStreamingEvent()
                      canvasStore.addToCanvas()
```

### 2. Canvas Persistence

```
User drags component → onDragEnd → updatePosition()
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

Components are compiled and executed at runtime in the browser. This allows AI-generated code to be rendered without a build step.

```
CanvasItem mounts → fetch `/api/projects/{id}/components/{name}`
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
                    Render in CanvasItem with error boundary
```

**Step-by-step breakdown:**

1. **Fetch Source**: Raw `.tsx` source is fetched from the server
2. **Strip Imports**: `prepareSource()` removes import statements (they'd fail at runtime)
3. **Convert Exports**: `export default function X` → `function X`
4. **Compile**: Sucrase transforms JSX and TypeScript to plain JavaScript
5. **Create Function**: `new Function()` wraps compiled code with scope injection
6. **Execute**: Function receives COMPONENT_SCOPE values, returns the component
7. **Render**: Component is rendered inside CanvasItem with error boundaries

**Why this approach:**
- No build step required for generated components
- Components are sandboxed - can only access COMPONENT_SCOPE
- Hot reload: edit code, re-fetch, re-compile
- Errors are caught and displayed in the canvas item

## Key Files

| File | Purpose |
|------|---------|
| `client/src/lib/api.ts` | All API calls, SSE streaming utility |
| `client/src/store/canvasStore.ts` | Central state: canvas, streaming, UI |
| `client/src/components/DragDropCanvas.tsx` | Canvas + CanvasItem rendering |
| `server/src/agents/baseAgent.ts` | Claude streaming loop, tool handling |
| `server/src/agents/componentAgent.ts` | Component generation tools |
| `server/src/services/fileService.ts` | Component CRUD operations |

## Streaming Pattern

All generation endpoints use Server-Sent Events (SSE):

```typescript
// Client (api.ts)
async function* postAndStream(url, body) {
  const response = await fetch(url, { method: 'POST', body });
  const reader = response.body.getReader();
  // ... yield JSON events
}

// Server (baseAgent.ts)
async *runAgentLoop() {
  const stream = client.messages.stream({ ... });
  for await (const event of stream) {
    yield { type: 'thinking', message: ... };
    yield { type: 'tool_result', ... };
  }
}
```

## State Management

Four Zustand stores with clear separation of concerns:

1. **canvasStore** - Canvas items, positions, sizes, selection, state connections
2. **generationStore** - AI generation state: streaming, status, component versions
3. **componentLibraryStore** - Available components in the library
4. **projectStore** - Current project metadata

## Component Scope (Sandboxed Environment)

Generated components run in a sandboxed environment. They cannot import arbitrary modules - only what's explicitly provided in `COMPONENT_SCOPE`:

```typescript
// componentRenderer.ts
const COMPONENT_SCOPE = {
  // React core
  React, useState, useEffect, useRef, useCallback, useMemo,

  // Cross-component state (from sharedStore.ts)
  useSharedState,

  // shadcn/ui components
  Button, Card, CardContent, CardHeader, CardTitle,
  Input, Label, Textarea, Checkbox, Dialog, Select, Tabs,
  Alert, Avatar, Badge, Separator, // etc.

  // Lucide icons (100+)
  ArrowRight, Check, ChevronDown, Heart, Home, Mail,
  Search, Settings, Star, User, X, // etc.
};
```

**Available to components:**
| Category | Examples |
|----------|----------|
| React | `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo` |
| UI Components | All shadcn/ui primitives (Button, Card, Dialog, etc.) |
| Icons | 100+ Lucide icons |
| State Sharing | `useSharedState(key)` for cross-component communication |

**Not available:**
- `fetch` / network requests
- `localStorage` / `sessionStorage`
- DOM manipulation (`document.querySelector`, etc.)
- External npm packages

This sandboxing prevents generated components from performing unsafe operations while still allowing rich, interactive UIs.
