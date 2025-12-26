# Componentize

AI-powered webpage design with a structured DSL that actually works.

## What Makes This Different

Unlike AI builders that dump messy code, Componentize gives the AI a **structured toolset**:
- **Section-based layouts** (nav, hero, features, footer)
- **Auto-positioning and centering** - no manual x/y coordinates
- **Real React components** with TypeScript + Tailwind
- **Interactive elements** (modals, drawers, shared state)
- **Live canvas** - watch components appear as the AI creates them

The AI understands the canvas. No more "fix the layout" loops.

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/componentize
cd componentize
npm install

# Set your API key
echo "ANTHROPIC_API_KEY=your_key_here" > server/.env

# Start both servers
npm run dev  # Starts server on :5001 and client on :5173
```

Open http://localhost:5173 and try: *"Build a SaaS landing page with navbar, hero section, 3 feature cards, pricing tiers, and footer"*

## How It Works

### The Design Agent DSL

The AI uses 5 core tools to build webpages:

| Tool | Purpose |
|------|---------|
| `set_page_style()` | Configure page width, background gradients |
| `edit_component()` | Create/update React components in sections |
| `get_layout()` | Inspect current page state |
| `create_layer()` | Add modals, drawers, popovers |
| `manage_todos()` | Track multi-step progress |

### Section-Based Layout

Components are organized into **sections** that stack vertically:

```
┌─────────────────────────────────────────┐
│  nav (row)     [Logo] [Links] [Button]  │
├─────────────────────────────────────────┤
│  hero (column)                          │
│              [Headline]                 │
│              [Subtext]                  │
│            [CTA Buttons]                │
├─────────────────────────────────────────┤
│  features (row)                         │
│    [Card 1]   [Card 2]   [Card 3]       │
├─────────────────────────────────────────┤
│  pricing (row)                          │
│    [Free]     [Pro]    [Enterprise]     │
├─────────────────────────────────────────┤
│  footer (column)                        │
│            [Footer Content]             │
└─────────────────────────────────────────┘
```

Each section auto-positions its components:
- **Column sections**: Stack vertically, each component centered
- **Row sections**: Place side-by-side, entire row centered

No manual coordinates. Just specify the section.

### Component Structure

Every component follows a simple pattern:

```tsx
export default function HeroHeadline() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <h1 className="text-6xl font-bold text-white">
        Build Something Amazing
      </h1>
    </div>
  );
}
```

The `w-full h-full` root allows the canvas to control sizing.

### Interactivity with Shared State

Components can communicate via `useSharedState`:

```tsx
// Button that opens modal
export default function SignupBtn() {
  const [, setOpen] = useSharedState('signup_open', false);
  return (
    <button onClick={() => setOpen(true)}>
      Get Started
    </button>
  );
}

// Modal that responds
export default function SignupModal() {
  const [open, setOpen] = useSharedState('signup_open', false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50">
      <div className="bg-white rounded-xl p-8">
        <h2>Sign Up</h2>
        <button onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}
```

### Layer System

Create modals, drawers, and popovers that overlay the page:

```typescript
create_layer({
  name: "signup-modal",
  type: "modal",
  components: ["SignupModalContent"],
  triggerComponent: "SignupBtn",
  triggerEvent: "click"
})
```

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Zustand
- **Backend**: Node.js, Fastify, TypeScript
- **AI**: Claude (Anthropic API) with streaming
- **Components**: shadcn/ui, Lucide icons

## Project Structure

```
componentize/
├── server/                  # Backend
│   ├── src/
│   │   ├── agents/         # AI agent + tools
│   │   │   ├── design/     # Design agent (prompt + handlers)
│   │   │   └── tools/      # Tool implementations
│   │   ├── services/       # File, project, export services
│   │   └── routes/         # API endpoints
│   └── projects/           # User projects stored here
│
├── client/                  # Frontend
│   ├── src/
│   │   ├── components/     # Canvas, chat panel, UI
│   │   ├── store/          # Zustand stores
│   │   └── hooks/          # Stream handling, etc.
│
├── shared/                  # Shared types
│   └── types/              # TypeScript interfaces
│
└── test-layouts/           # Reference implementations
    └── src/generated/      # Hand-crafted example layouts
```

## API Overview

### Streaming Generation

```
POST /api/generate/stream?projectId=xxx
Content-Type: application/json
{ "prompt": "Build a pricing page with 3 tiers" }
```

Returns Server-Sent Events:
- `thinking` - AI reasoning
- `tool_call` - Tool invocation
- `tool_result` - Tool output + canvas/layout updates
- `complete` - Generation finished

### Project Management

```
GET  /api/projects                    # List projects
POST /api/projects                    # Create project
GET  /api/projects/:id                # Get project (layout, canvas, history)
GET  /api/projects/:id/components     # List components
POST /api/projects/:id/export         # Export as ZIP
```

## Example Prompts

**Landing Page:**
> "Build a complete SaaS landing page with dark theme: navbar with logo and signup button, hero section with headline and CTA, 3 feature cards in a row, pricing section with 3 tiers, and footer. Make the signup button open a modal."

**Dashboard:**
> "Build an analytics dashboard with 4 stat cards showing revenue, users, orders, and growth. Add a chart placeholder and an activity feed."

**E-commerce:**
> "Build a product page with large product image, title, price, size selector buttons, add to cart button, and customer reviews section."

## Development

```bash
# Run both servers with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Environment Variables

**server/.env:**
```env
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=development
PORT=5001
```

**client/.env:**
```env
VITE_API_BASE_URL=http://localhost:5001
```

## Architecture Decisions

### Why a DSL Instead of Free-Form Code?

Traditional AI code generators output unstructured code. Every change requires the AI to reason about layout from scratch. Results are inconsistent.

Componentize constrains the AI with a structured DSL:
- **Sections** define layout semantics (not pixel positions)
- **Components** are small, focused units (10-30 lines each)
- **Tools** have clear contracts and validation

The AI doesn't need to solve layout - the system calculates positions automatically.

### Why Section-Based Layout?

Most web pages follow predictable patterns: nav at top, hero, features, pricing, footer. Rather than letting the AI specify arbitrary coordinates, we let it describe *intent*:

```typescript
edit_component("PricingPro", code, {
  section: "pricing",      // Goes in pricing section
  sectionLayout: "row",    // This section is horizontal
  size: { width: 350, height: 450 }
})
```

The canvas engine then:
1. Stacks sections vertically
2. Positions components within sections
3. Centers everything appropriately

Result: Consistent, professional layouts every time.

### Why Streaming?

AI operations take 10-30 seconds. Users need feedback. We stream:
- Thinking tokens (so users see the AI reasoning)
- Tool calls (so users see what's being created)
- Canvas updates (so components appear in real-time)

Every tool result can include canvas and layout updates that the client applies immediately.

## License

MIT
