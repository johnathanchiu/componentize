# Componentize - AI-Powered Component Builder

A full-stack TypeScript application for generating, editing, and composing React components using AI. Build interactive UIs through a visual drag-and-drop canvas with real-time AI assistance.

## Features

- **AI Component Generation with Streaming**: Describe components in natural language with real-time progress feedback
- **Visual + AI Editing**: Edit components visually or use AI for complex changes
- **AI Interaction Generation**: Add event handlers (onClick, onChange, onSubmit) using natural language
- **Drag & Drop Canvas**: Visually arrange and resize components
- **Component Error Fixing**: Auto-fix component errors with AI
- **Complete Project Export**: Export as ZIP with all dependencies and configuration
- **Real-time Streaming**: All AI operations show live progress with Server-Sent Events

## Architecture

```
┌─────────────────────────────────┐
│  React + Vite Frontend          │
│  - Drag-and-drop UI             │
│  - Real-time streaming UI       │
│  - Property panel editing       │
└────────────┬────────────────────┘
             │ SSE + HTTP
┌────────────▼────────────────────┐
│  TypeScript + Fastify Backend   │
│  - Server-Sent Events (SSE)     │
│  - AI Agents (streaming)        │
│  - ZIP export service           │
└────────────┬────────────────────┘
             │ @anthropic-ai/sdk
┌────────────▼────────────────────┐
│  File System                    │
│  /server/components/*.tsx       │
└─────────────────────────────────┘
```

## Prerequisites

- **Node.js** 18+ and npm
- **Anthropic API Key** - Get one at https://console.anthropic.com/

## Project Structure

```
componentize/
├── server/                  # Backend TypeScript server
│   ├── src/
│   │   ├── agents/         # AI agents (base, component, interaction)
│   │   ├── services/       # Business logic (file, export, preview)
│   │   ├── config/         # Configuration with Zod validation
│   │   └── server.ts       # Fastify server with SSE endpoints
│   ├── components/         # Generated components stored here
│   └── package.json
│
├── client/                  # Frontend React app
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── store/          # Zustand state management
│   │   ├── lib/            # API client with streaming
│   │   ├── config/         # Frontend configuration
│   │   └── types/          # TypeScript types
│   └── package.json
│
└── shared/                  # Shared types and constants
    ├── types/              # Shared TypeScript interfaces
    └── constants/          # Shared constants (model name, limits, etc.)
```

## Setup

### 1. Clone and Install

```bash
# Clone the repository
cd /path/to/componentize

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables

**Backend** (`server/.env`):
```env
ANTHROPIC_API_KEY=your_api_key_here
NODE_ENV=development
PORT=5001
COMPONENTS_DIR=./components
```

**Frontend** (`client/.env`):
```env
VITE_API_BASE_URL=http://localhost:5001
```

## Running the Application

You need to run **both** the backend and frontend servers:

### Terminal 1 - Backend

```bash
cd server
npm run dev
```

The backend will start on **http://localhost:5001**

### Terminal 2 - Frontend

```bash
cd client
npm run dev
```

The frontend will start on **http://localhost:5173**

Open your browser to **http://localhost:5173** to use the app!

## Usage

### 1. Generate a Component

- Enter a component name (e.g., `PricingCard`, `HeroSection`)
- Describe what you want in the text area
- Click "Generate Component"
- Watch real-time progress as Claude creates the component
- Component is automatically added to your library

### 2. Build Your Canvas

- **Drag from library**: Drag components onto the canvas
- **Reposition**: Drag component edges to move
- **Resize**: Drag bottom-right corner to resize
- **Delete**: Click trash icon that appears on hover
- **Select**: Click component to open controls

### 3. Edit Components

**Visual Editing (Properties Panel)**:
- Click "Properties" button in header (component must be selected)
- Adjust position (X, Y coordinates)
- Adjust size (width, height)
- Click "Apply" to save changes

**AI Editing (Component Controls)**:
- Select a component on canvas
- Click "Edit with AI" in the component controls panel
- Describe changes (e.g., "Center the text and make button blue")
- Watch real-time progress as AI updates the component

### 4. Add Interactions

- Select a component on canvas
- Click "Add Interaction" in the component controls panel
- Choose event type (onClick, onChange, onSubmit)
- Describe what should happen
- AI generates the handler code and state management

### 5. Fix Errors

If a component has errors:
- Error overlay appears automatically
- Click "Fix with AI" button
- AI analyzes and fixes the error
- Component auto-refreshes on success

### 6. Export Your Project

- Click "Export Page" in the header
- A ZIP file downloads with:
  - All component files
  - Page file with your layout
  - Complete package.json
  - Config files (tsconfig, vite, tailwind)
  - README with instructions
- Extract and run: `npm install && npm run dev`

## Tech Stack

### Frontend
- **React 19** - UI library
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **@dnd-kit** - Drag and drop functionality
- **re-resizable** - Component resizing
- **Zustand** - State management
- **Lucide React** - Icons

### Backend
- **Node.js 18+** - Runtime
- **TypeScript** - Type safety
- **Fastify** - Web framework
- **@anthropic-ai/sdk** - Claude AI integration (TypeScript SDK)
- **Zod** - Runtime type validation
- **Archiver** - ZIP file generation
- **Pino** - Structured logging

## API Endpoints

All AI endpoints use **Server-Sent Events (SSE)** for real-time streaming progress.

### Streaming Endpoints

**POST** `/api/generate-component-stream` - Generate component with streaming
```json
{
  "prompt": "A modern pricing card with title, price, features, and CTA",
  "componentName": "PricingCard"
}
```

**POST** `/api/edit-component-stream` - Edit component with streaming
```json
{
  "componentName": "PricingCard",
  "editDescription": "Make the title larger and center everything"
}
```

**POST** `/api/generate-interaction-stream` - Generate interaction with streaming
```json
{
  "componentId": "pricing-card-123",
  "componentName": "PricingCard",
  "description": "When button is clicked, log to console",
  "eventType": "onClick"
}
```

**Stream Event Format:**
```json
{
  "type": "progress" | "success" | "error" | "thinking" | "tool_call",
  "message": "Creating component...",
  "data": { /* optional result data */ }
}
```

### Standard Endpoints

**GET** `/api/health` - Health check

**GET** `/api/list-components` - List all available components

**GET** `/api/get-component-code/:componentName` - Get component source code

**GET** `/preview/:componentName` - Get HTML preview for iframe

**POST** `/api/export-page` - Export page as ZIP file
```json
{
  "pageName": "MyPage",
  "layout": {
    "components": [/* canvas components with positions, sizes, interactions */]
  }
}
```
Returns ZIP file as blob.

## Example Workflow

```
1. Generate Component
   User: "Create a hero section with a title, subtitle, and CTA button"
   → Sees real-time progress: "Generating component... Creating file..."
   → HeroSection.tsx created in /server/components/
   → Component appears in library

2. Add to Canvas
   User: Drags HeroSection to canvas at (100, 50)
   → Component renders in iframe with live preview
   → Can resize and reposition

3. Edit Component
   User: Selects component, clicks "Edit with AI"
   User: "Make the title larger and add a gradient background"
   → Sees streaming progress
   → Component auto-refreshes with changes

4. Add Interaction
   User: Clicks "Add Interaction", selects "onClick"
   User: "Navigate to /pricing page"
   → AI generates router navigation code
   → Interaction appears in component controls

5. Generate More Components
   User: "Create a pricing card with tier, price, features list"
   → Streaming progress indicator
   → PricingCard added to library

6. Compose Page
   User: Drags PricingCard to canvas at (100, 400)
   User: Opens Properties panel to fine-tune position to (120, 450)
   User: Resizes to 300x400

7. Export
   User: Clicks "Export Page"
   → Downloads MyPage.zip
   → Contains all components, configs, and runnable project
   → Unzip, npm install, npm run dev - ready to go!
```

## Development

### Backend Development

```bash
cd server
npm run dev        # Start with watch mode (tsx watch)
npm run build      # Build TypeScript to dist/
npm start          # Run built code
```

### Frontend Development

```bash
cd client
npm run dev      # Start Vite dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Code Organization

**Backend Architecture:**
- `BaseAgent` - Shared agent logic with streaming support
- `ComponentAgent` - Handles component generation and editing
- `InteractionAgent` - Handles interaction generation
- `FileService` - File operations with validation
- `ExportService` - ZIP bundling with project scaffolding
- `PreviewService` - HTML generation for iframe previews

**Frontend Architecture:**
- Component-based React structure
- Zustand for global state (canvas components, selections)
- Streaming API client using AsyncGenerator pattern
- Real-time UI updates via SSE consumption

## Troubleshooting

### Backend won't start

**Error:** `ANTHROPIC_API_KEY is required`
- Make sure `.env` file exists in `server/` directory
- Verify API key is set correctly

**Error:** `Port 5001 already in use`
- Change `PORT` in `.env` or kill process using port:
```bash
lsof -ti:5001 | xargs kill -9
```

### Frontend can't connect to backend

**Error:** Network error messages
- Verify backend is running on http://localhost:5001
- Check `VITE_API_BASE_URL` in `client/.env`
- Check browser console for CORS errors

### Component preview not loading

- Check browser console for iframe errors
- Verify component file exists in `server/components/`
- Check for syntax errors in generated component
- Try "Fix with AI" if component has errors

### TypeScript build errors

```bash
# Backend
cd server
npm run build

# Frontend
cd client
npm run build
```

Check output for specific errors. Most common:
- Missing shared types - verify `/shared` directory structure
- Import path issues - check relative paths
- Type mismatches - ensure types are synced between frontend/backend

## Key Architecture Decisions

### Why TypeScript Backend?

**Before:** Python Flask backend
**After:** TypeScript/Node.js with Fastify

**Benefits:**
- End-to-end type safety via `/shared` types
- Single language across full stack
- Better IDE support and autocomplete
- Faster development with hot reload
- Native SDK support for streaming

### Why Streaming Everywhere?

**Problem:** Users waiting 10-30s with no feedback

**Solution:** Server-Sent Events for all AI operations

**Benefits:**
- Real-time progress indicators
- Better UX - users see AI thinking
- Tool call visibility
- Early error detection

### Why Base Agent Pattern?

**Problem:** 3 agents with duplicate streaming logic

**Solution:** `BaseAgent` class with shared `runAgentLoop()`

**Benefits:**
- DRY principle - single source of truth
- Consistent error handling and retries
- Easy to add new agents
- Centralized streaming logic

### Why ZIP Export?

**Problem:** Export gave single file, missing dependencies

**Solution:** Complete project bundle in ZIP

**Benefits:**
- Immediately runnable - just unzip and npm install
- All dependencies included
- Professional project structure
- Production-ready configuration

## Contributing

Code follows these principles:
- **Type Safety First** - No `any` types, use strict TypeScript
- **DRY** - Shared code in base classes or utilities
- **Streaming by Default** - All AI operations use SSE
- **Config Over Hardcoding** - Use env vars and config files
- **Graceful Error Handling** - Clear user-facing messages

## License

MIT
