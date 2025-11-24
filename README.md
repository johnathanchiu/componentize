# Component Builder

An AI-powered visual component builder that lets you generate React components from text prompts and arrange them on a canvas using drag-and-drop. Built with React, Vite, Tailwind CSS, and Claude Agent SDK.

## Features

- **AI Component Generation**: Describe components in natural language and Claude generates React + TypeScript + Tailwind code
- **AI Interaction Generation**: Add event handlers and state to components using natural language descriptions
- **Drag & Drop Canvas**: Visually arrange components on a canvas
- **Real File Output**: Components are created as actual `.tsx` files, not eval'd strings
- **Page Export**: Export your canvas layout as a complete React page with state management and event handlers
- **Zero Code Visibility**: Users work with a visual interface - code is abstracted away

## Architecture

```
┌─────────────────────────────────┐
│  React + Vite Frontend          │
│  - Drag-and-drop UI             │
│  - Component generation         │
└────────────┬────────────────────┘
             │ HTTP
┌────────────▼────────────────────┐
│  Python Flask Backend           │
│  - REST API endpoints           │
└────────────┬────────────────────┘
             │ Claude Agent SDK
┌────────────▼────────────────────┐
│  File System                    │
│  /generated/components/*.tsx    │
└─────────────────────────────────┘
```

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.12+ (for backend)
- **uv** (optional, recommended) - Fast Python package manager. Install: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **Anthropic API Key** - Get one at https://console.anthropic.com/

## Project Structure

```
componentize/
├── client/                # React + Vite app
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── store/        # Zustand state management
│   │   ├── types/        # TypeScript types
│   │   └── lib/          # API utilities
│   └── package.json
│
├── app/                   # Python Flask API
│   ├── agent/            # Claude Agent SDK integration
│   │   ├── component_agent.py
│   │   ├── interaction_agent.py
│   │   └── tools.py
│   ├── main.py           # Flask server
│   ├── requirements.txt
│   └── .env              # API keys (create from .env.example)
│
└── generated/             # AI-generated components
    ├── components/       # Generated .tsx components
    └── pages/            # Exported pages
```

## Setup

### 1. Clone and Navigate

```bash
cd /path/to/componentize
```

### 2. Backend Setup (Python)

Choose either **Option A** (uv - faster, recommended) or **Option B** (traditional pip):

#### Option A: Using uv (Recommended)

```bash
# Navigate to backend
cd app

# Create virtual environment with uv
uv venv --prompt componentize

# Activate virtual environment
source .venv/bin/activate  # On macOS/Linux
# OR
.venv\Scripts\activate     # On Windows

# Install dependencies (much faster than pip!)
uv pip install -r requirements.txt
# OR install from pyproject.toml
uv sync

# Create .env file and add your Anthropic API key
cp .env.example .env
# Edit .env and add: ANTHROPIC_API_KEY=your_key_here
```

#### Option B: Using standard Python venv

```bash
# Navigate to backend
cd app

# Create virtual environment with custom prompt name
# The --prompt flag lets you display "componentize" in your terminal instead of ".venv"
python3 -m venv .venv --prompt componentize

# Activate virtual environment
source .venv/bin/activate  # On macOS/Linux
# OR
.venv\Scripts\activate     # On Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file and add your Anthropic API key
cp .env.example .env
# Edit .env and add: ANTHROPIC_API_KEY=your_key_here
```

**Note:** Virtual environments cannot be moved after creation due to hardcoded paths. Always create the venv with the final directory name you want, or use `--prompt` to customize the display name.

### 3. Frontend Setup (React)

```bash
# Navigate to frontend (from project root)
cd client

# Install dependencies
npm install
```

## Running the Application

You need to run **both** the backend and frontend servers:

### Terminal 1 - Backend (Flask)

```bash
cd app
source .venv/bin/activate
python main.py
```

The backend will start on **http://localhost:5001**

### Terminal 2 - Frontend (Vite)

```bash
cd client
npm run dev
```

The frontend will start on **http://localhost:5173**

Open your browser to **http://localhost:5173** to use the app!

## Usage

1. **Generate a Component**
   - Enter a component name (e.g., `PricingCard`, `HeroSection`)
   - Describe what you want in the text area
   - Click "Generate Component"
   - Claude will create a real `.tsx` file in `/generated/components/`

2. **Build Your Page**
   - Drag components from the library onto the canvas
   - Position them where you want
   - Drag existing components to reposition them
   - Click the trash icon to remove components

3. **Export Your Page**
   - Click "Export Page" in the header
   - A `.tsx` file will download with all your components arranged
   - The exported page includes proper imports and absolute positioning

## Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **@dnd-kit** - Drag and drop functionality
- **Zustand** - State management
- **Lucide React** - Icons

### Backend
- **Python 3.12+** - Runtime
- **Flask** - Web framework
- **Anthropic SDK** - Claude AI integration
- **uv** (optional) - Fast Python package manager

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/generate-component` - Generate a new component
  ```json
  {
    "prompt": "A modern pricing card...",
    "componentName": "PricingCard"
  }
  ```
- `POST /api/generate-interaction` - Generate an event handler for a component
  ```json
  {
    "componentId": "unique-id",
    "componentName": "Button",
    "description": "Show an alert when clicked",
    "eventType": "onClick"
  }
  ```
- `GET /api/list-components` - List all generated components
- `POST /api/export-page` - Export canvas layout as a page with interactions
  ```json
  {
    "pageName": "MyPage",
    "layout": {
      "components": [...]
    }
  }
  ```

## Example Workflow

```
1. User: "Create a hero section with a title, subtitle, and CTA button"
   └─> Claude generates HeroSection.tsx in /generated/components/

2. User: Drags HeroSection to canvas at position (100, 50)
   └─> Component appears on canvas

3. User: "Create a pricing card with features"
   └─> Claude generates PricingCard.tsx

4. User: Drags PricingCard to canvas at position (100, 400)

5. User: Clicks "Export Page"
   └─> MyPage.tsx downloads with both components positioned correctly
```

## Development

### Frontend Development

```bash
cd client
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Backend Development

The Flask server runs in debug mode by default, so changes are auto-reloaded.

## Troubleshooting

**"Network error" when generating components**
- Make sure the backend server is running on port 5001
- Check that your `ANTHROPIC_API_KEY` is set in `app/.env`

**Components not appearing in library**
- Click the refresh button in the component library
- Check `/generated/components/` directory for `.tsx` files

**CORS errors**
- Backend has CORS enabled for all origins in development
- If issues persist, check Flask-CORS configuration in `app/main.py`

## Python Dependency Management - Quick Reference

| Task | Using uv | Using pip |
|------|----------|-----------|
| Create venv | `uv venv --prompt componentize` | `python3 -m venv .venv --prompt componentize` |
| Install deps | `uv pip install -r requirements.txt` | `pip install -r requirements.txt` |
| Install from pyproject.toml | `uv sync` | `pip install -e .` |
| Add package | `uv pip install package-name` | `pip install package-name` |
| Update requirements.txt | `uv pip freeze > requirements.txt` | `pip freeze > requirements.txt` |

**Why uv?** It's 10-100x faster than pip for installing packages!

## Future Enhancements

- [ ] Component props editing in UI
- [ ] Undo/redo functionality
- [ ] Component templates/presets
- [ ] Responsive preview modes
- [ ] Save/load projects
- [ ] Component search and filtering
- [ ] Real-time component preview

## License

MIT
