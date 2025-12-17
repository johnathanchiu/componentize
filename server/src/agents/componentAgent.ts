import { v4 as uuidv4 } from 'uuid';
import { BaseAgent, type Tool, type ToolResult } from './baseAgent';
import { fileService } from '../services/fileService';
import { projectService } from '../services/projectService';
import { validateComponent } from './componentValidator';
import type { StreamEvent, CanvasComponent, ComponentPlan, Interaction, StateVariable, InteractionType, LayoutDefinition, CanvasLayout, LayoutChild } from '../../../shared/types';

// Default position when not specified by agent
const DEFAULT_POSITION = { x: 400, y: 300 };
const DEFAULT_SIZE = { width: 300, height: 200 };
const MAX_COMPONENT_LINES = 50;

const COMPONENT_TOOLS: Tool[] = [
  {
    name: 'plan_components',
    description: 'Plan which components to create for a complex request. Use this for landing pages, dashboards, or any request requiring multiple components. Skip for simple single-component requests.',
    input_schema: {
      type: 'object',
      properties: {
        components: {
          type: 'array',
          description: 'List of components to create',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'PascalCase component name (e.g., HeroHeadline, PricingCard)'
              },
              description: {
                type: 'string',
                description: 'What this component should look like and do'
              },
              position: {
                type: 'object',
                description: 'Optional position on canvas',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' }
                }
              },
              size: {
                type: 'object',
                description: 'Optional size',
                properties: {
                  width: { type: 'number' },
                  height: { type: 'number' }
                }
              }
            },
            required: ['name', 'description']
          }
        }
      },
      required: ['components']
    }
  },
  {
    name: 'create_component',
    description: 'Create a new React TypeScript component and place it on the canvas. For simple requests, call this directly. For complex requests, call plan_components first.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Component name in PascalCase (e.g., Button, PricingCard)'
        },
        code: {
          type: 'string',
          description: 'The complete React TypeScript component code including imports, types, and export'
        },
        position: {
          type: 'object',
          description: 'Optional position on canvas. If omitted, defaults to center (400, 300)',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          }
        },
        size: {
          type: 'object',
          description: 'Optional size. If omitted, defaults to 300x200',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' }
          }
        }
      },
      required: ['name', 'code']
    }
  },
  {
    name: 'read_component',
    description: 'Read the current code of an existing component. Use this before updating to see the current implementation.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the component to read'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'update_component',
    description: 'Update an existing React component file with new code. Always provide the COMPLETE updated code, not just the changes.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the component to update'
        },
        code: {
          type: 'string',
          description: 'The COMPLETE updated React component code (not a diff, the full file)'
        }
      },
      required: ['name', 'code']
    }
  },
  {
    name: 'create_interaction',
    description: 'Create an interaction/event handler for a component with generated code and state.',
    input_schema: {
      type: 'object',
      properties: {
        handlerName: {
          type: 'string',
          description: 'Name of the event handler function (e.g., handleClick, handleSubmit)'
        },
        code: {
          type: 'string',
          description: 'The complete event handler code'
        },
        state: {
          type: 'array',
          description: 'State variables needed for this interaction',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              initialValue: { type: ['string', 'number', 'boolean'] },
              type: { type: 'string' }
            },
            required: ['name', 'initialValue', 'type']
          }
        }
      },
      required: ['handlerName', 'code']
    }
  },
  {
    name: 'create_layout',
    description: 'Compose multiple components using layout primitives (Stack, Flex, Grid, Container). Use this when components need to be arranged together (e.g., 3 cards in a row, hero with stacked content). Components must be created first before adding them to a layout.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Layout name in PascalCase (e.g., PricingSection, HeroArea)'
        },
        layout: {
          type: 'object',
          description: 'Layout definition using primitives',
          properties: {
            type: {
              type: 'string',
              enum: ['Stack', 'Flex', 'Grid', 'Container'],
              description: 'The layout primitive to use'
            },
            props: {
              type: 'object',
              description: 'Props for the layout primitive (gap, align, justify, direction, etc.)'
            },
            children: {
              type: 'array',
              description: 'Child elements - component references or nested layouts',
              items: {
                type: 'object'
              }
            }
          },
          required: ['type', 'children']
        },
        position: {
          type: 'object',
          description: 'Position on canvas for the layout',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          }
        },
        size: {
          type: 'object',
          description: 'Size of the layout container',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' }
          }
        }
      },
      required: ['name', 'layout']
    }
  },
  {
    name: 'manage_todos',
    description: 'Manage your task list. Use this to plan work, track progress, and show users what you are doing. Call this BEFORE starting work to create tasks, and after completing each task to mark it done.',
    input_schema: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'The complete updated todo list',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique ID for the todo (e.g., "task-1")' },
              content: { type: 'string', description: 'Task description' },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed'],
                description: 'Task status'
              }
            },
            required: ['id', 'content', 'status']
          }
        }
      },
      required: ['todos']
    }
  }
];

const SYSTEM_PROMPT = `You are an expert React/TypeScript developer. Your job is to create beautiful, functional components.

WORKFLOW:
- SIMPLE requests (button, card, single form): Call create_component directly - no planning needed
- COMPLEX requests (landing page, dashboard, multiple elements): Call plan_components first, then create_component for each
- EDIT requests (modify existing component): Call read_component first, then update_component

ATOMIC COMPONENT RULES:
- Each component does ONE thing - if it has multiple responsibilities, break it up
- Target: 20-30 lines of code (hard limit: 50 lines)
- No internal layout grids - user arranges components on canvas
- Examples of atomic vs non-atomic:
  ✓ HeroHeadline (just the headline text with styling)
  ✓ HeroCTA (just the call-to-action button)
  ✓ HeroImage (just the hero image)
  ✗ HeroSection (text + button + image combined)
  ✓ PricingPrice (just "$99/month" with styling)
  ✓ PricingFeatureList (just the feature bullets)
  ✓ PricingCTA (just the "Get Started" button)
  ✗ PricingCard (everything combined)
- Name components descriptively: HeroHeadline, PricingCardPro, EmailSignupForm

CONSISTENCY RULES (IMPORTANT):
- When creating multiple similar components (e.g., 3 pricing cards, 3 feature cards):
  1. Use IDENTICAL fixed dimensions with Tailwind: className="w-80 h-96" or similar
  2. Use the SAME structure - if one card has a Badge, ALL cards should have a Badge slot
  3. Use the SAME number of content items (e.g., all pricing cards show exactly 4 features)
  4. Specify the SAME size in plan_components for all similar components
- Example for consistent cards:
  <Card className="w-72 h-80">  // Fixed width and height for ALL cards in the group
    <CardHeader className="h-24">  // Fixed header height
      {/* Badge slot - use invisible placeholder if not needed */}
      <Badge className={showBadge ? "" : "invisible"}>Popular</Badge>
      ...
    </CardHeader>
    <CardContent className="h-32">  // Fixed content height
      ...
    </CardContent>
  </Card>
- For feature cards, testimonial cards, team member cards - ALWAYS use fixed dimensions
- Never let cards auto-size to content when they appear in a row/grid

POSITIONING:
- Look at CURRENT CANVAS in the user message to see existing component positions
- Place new components to avoid overlap with existing ones
- Common layout patterns:
  - Header/nav at top (y: 0-60)
  - Hero content (y: 60-200)
  - Cards in horizontal row (same y, x: 100, 400, 700)
  - Main content in middle (y: 300-500)
  - Footer at bottom (y: 600+)

LAYOUT COMPOSITION:
When creating related components that should be arranged together (cards in row, hero sections, etc.):

WRONG: Create 3 cards and manually position at x: 100, 400, 700
RIGHT: Create 3 cards first, then use create_layout to compose them

Example flow for pricing cards:
1. create_component PricingCardBasic
2. create_component PricingCardPro
3. create_component PricingCardEnterprise
4. create_layout PricingSection with Flex to arrange them in a row

Layout primitives:
- Stack: Vertical or horizontal stacking with gap. Props: direction, gap, align, justify
- Flex: Explicit flexbox control. Props: direction, wrap, gap, align, justify
- Grid: CSS Grid for complex layouts. Props: columns, rows, gap
- Container: Width constraints and centering. Props: maxWidth, center, padding

Example create_layout call:
{
  "name": "PricingSection",
  "layout": {
    "type": "Flex",
    "props": { "gap": 6, "justify": "center", "wrap": true },
    "children": [
      { "component": "PricingCardBasic" },
      { "component": "PricingCardPro" },
      { "component": "PricingCardEnterprise" }
    ]
  },
  "position": { "x": 100, "y": 300 }
}

WHEN TO USE LAYOUTS:
- Multiple cards in a row (pricing, features, testimonials)
- Hero with stacked headline + subtext + CTA
- Form with label-input pairs
- Header with logo + nav + actions
- Any group of components that should stay together

WHEN NOT TO USE LAYOUTS:
- Single standalone component
- Components that user wants to position independently

CODE REQUIREMENTS:
- TypeScript with proper types (no 'any' unless necessary)
- Tailwind CSS for all styling (no inline styles, no CSS files)
- Functional components with hooks
- Accessible (aria-labels, semantic HTML)
- Export as default

SHADCN/UI COMPONENTS AVAILABLE:
  import { Button } from "@/components/ui/button"
  import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
  import { Input } from "@/components/ui/input"
  import { Label } from "@/components/ui/label"
  import { Textarea } from "@/components/ui/textarea"
  import { Badge } from "@/components/ui/badge"
  import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
  import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
  import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
  import { Checkbox } from "@/components/ui/checkbox"
  import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
  import { Separator } from "@/components/ui/separator"
  import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

LUCIDE ICONS AVAILABLE:
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Check, CheckCircle, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Clock, Copy, Download, Edit, ExternalLink, Eye, EyeOff, File,
  Filter, Heart, Home, Image, Info, Link, Loader2, Lock, LogIn, LogOut, Mail, Menu,
  MessageCircle, Minus, Moon, MoreHorizontal, MoreVertical, Phone, Plus, RefreshCw, Search,
  Send, Settings, Share, ShoppingCart, Sparkles, Star, Sun, Trash, Trash2, Upload, User,
  Users, X, Zap, AlertCircle, AlertTriangle, Bell, Bookmark, Calendar, Camera, CreditCard,
  Database, Folder, Gift, Globe, Grid, HelpCircle, Inbox, Layers, Layout, List, MapPin,
  Maximize, Minimize, Monitor, Package, Pause, Play, Power, Printer, Quote, Radio, Save, Shield,
  Smartphone, Speaker, Tag, Target, Terminal, ThumbsUp, ThumbsDown, TrendingUp, TrendingDown,
  Truck, Tv, Type, Umbrella, Underline, Unlock, Video, Wifi, Wind, Award, BarChart, Briefcase,
  Building, Code, Coffee, Compass, Cpu, DollarSign, Feather, Flag, Headphones, Key, Lightbulb,
  Mic, Music, PenTool, Percent, PieChart, Rocket, Scissors, Server, Sliders, Smile, Snowflake,
  Timer, ToggleLeft, ToggleRight, Trophy, Wrench,
  // Social icons:
  Github, Twitter, Linkedin, Facebook, Instagram, Youtube

SHARED STATE (for inter-component communication):
  const [value, setValue] = useSharedState('keyName', defaultValue);

Example: FilterPanel and ProductGrid sharing filters
  // In FilterPanel
  const [filters, setFilters] = useSharedState('filters', {});

  // In ProductGrid
  const [filters] = useSharedState('filters', {});

TASK TRACKING:
- For multi-component requests: call BOTH plan_components AND manage_todos
  1. First call plan_components to register what you'll create
  2. Then call manage_todos to show the user your task list
  3. Create each component, updating manage_todos after each
- For simple single-component requests, skip both - just call create_component directly
- Example workflow for 3 pricing cards:
  1. plan_components([{name: "PricingBasic", ...}, {name: "PricingPro", ...}, {name: "PricingEnterprise", ...}])
  2. manage_todos([{id:"1", content:"Create PricingBasic", status:"in_progress"}, ...])
  3. create_component PricingBasic
  4. manage_todos([{id:"1", content:"Create PricingBasic", status:"completed"}, {id:"2", ..., status:"in_progress"}, ...])
  5. create_component PricingPro
  6. ... and so on until all are done

IMPORTANT:
- ALWAYS use tools. Never respond with just text.
- When creating, call create_component with complete code.
- When editing, first call read_component, then update_component.
- NEVER ask questions. Make reasonable decisions and proceed.
- Write working code on the first attempt.`;

interface PlanComponentsInput {
  components: Array<{
    name: string;
    description: string;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
  }>;
}

interface CreateComponentInput {
  name: string;
  code: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface InteractionToolInput {
  handlerName: string;
  code: string;
  state?: StateVariable[];
}

interface CreateLayoutInput {
  name: string;
  layout: LayoutDefinition;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface ManageTodosInput {
  todos: Array<{
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
}

export class ComponentAgent extends BaseAgent {
  private projectId: string | null = null;
  private pendingPlan: ComponentPlan[] = [];
  private createdComponents: string[] = [];

  constructor() {
    super(COMPONENT_TOOLS, SYSTEM_PROMPT);
  }

  /**
   * Set the project context for subsequent operations
   */
  setProjectContext(projectId: string): void {
    this.projectId = projectId;
    this.pendingPlan = [];
    this.createdComponents = [];
  }

  /**
   * Clear the project context
   */
  clearProjectContext(): void {
    this.projectId = null;
    this.pendingPlan = [];
    this.createdComponents = [];
  }

  /**
   * Validate component size - returns error message if too large, null if OK
   */
  private validateComponentSize(name: string, code: string): string | null {
    const lineCount = code.split('\n').length;
    if (lineCount > MAX_COMPONENT_LINES) {
      return `Component "${name}" is ${lineCount} lines, which exceeds the ${MAX_COMPONENT_LINES}-line limit. ` +
        `Components must be ATOMIC and single-purpose. This component is too complex - break it into smaller pieces. ` +
        `For example, if this is a "HeroSection", create just "HeroHeadline" (text only) or "HeroCTA" (button only). ` +
        `Try again with a simpler component under ${MAX_COMPONENT_LINES} lines.`;
    }
    return null;
  }

  /**
   * Extract all component names from a layout definition (recursive)
   */
  private extractComponentNamesFromLayout(layout: LayoutDefinition): string[] {
    const names: string[] = [];

    const traverse = (child: LayoutChild) => {
      if ('component' in child) {
        names.push(child.component);
      } else if ('children' in child) {
        // It's a nested layout
        child.children.forEach(traverse);
      }
    };

    layout.children.forEach(traverse);
    return [...new Set(names)]; // Deduplicate
  }

  /**
   * Build canvas context string to inject into the user prompt
   * Shows what components are on canvas and what's available
   */
  private async buildCanvasContext(): Promise<string> {
    if (!this.projectId) {
      return 'CURRENT CANVAS: Empty (no project set)';
    }

    const canvas = await projectService.getCanvas(this.projectId);
    const allComponents = await projectService.listComponents(this.projectId);

    if (canvas.length === 0 && allComponents.length === 0) {
      return 'CURRENT CANVAS: Empty (no components yet)';
    }

    // Build list of components on canvas with positions
    const onCanvas = canvas.map(c => {
      const pos = `(${c.position.x}, ${c.position.y})`;
      const size = c.size ? `, ${c.size.width}x${c.size.height}` : '';
      return `  - ${c.componentName} at ${pos}${size}`;
    }).join('\n');

    // Find components that exist but aren't on canvas
    const canvasNames = new Set(canvas.map(c => c.componentName));
    const available = allComponents.filter(c => !canvasNames.has(c));

    let context = 'CURRENT CANVAS:';

    if (canvas.length > 0) {
      context += `\nComponents on canvas:\n${onCanvas}`;
    } else {
      context += '\nComponents on canvas: (none)';
    }

    if (available.length > 0) {
      context += `\n\nAvailable components (not placed): ${available.join(', ')}`;
    }

    return context;
  }

  protected async executeTool(toolName: string, toolInput: unknown): Promise<ToolResult> {
    if (!this.projectId) {
      return { status: 'error', message: 'No project context set' };
    }

    switch (toolName) {
      case 'plan_components': {
        const { components } = toolInput as PlanComponentsInput;

        // Auto-assign positions to components that don't have them
        // Layout: 3 columns grid with spacing
        const GRID_COLUMNS = 3;
        const SPACING_X = 350;
        const SPACING_Y = 450;
        const START_X = 100;
        const START_Y = 100;

        // Store the plan with auto-calculated positions
        this.pendingPlan = components.map((c, index) => ({
          name: c.name,
          description: c.description,
          position: c.position || {
            x: START_X + (index % GRID_COLUMNS) * SPACING_X,
            y: START_Y + Math.floor(index / GRID_COLUMNS) * SPACING_Y
          },
          size: c.size || { width: 320, height: 400 }
        }));

        return {
          status: 'success',
          message: `Planned ${components.length} components: ${components.map(c => c.name).join(', ')}. Now create each one.`,
          plan: this.pendingPlan,
          totalComponents: components.length
        };
      }

      case 'create_component': {
        const input = toolInput as CreateComponentInput;
        const { name, code } = input;

        // Use position/size from plan if available, else from input, else default
        const plannedComponent = this.pendingPlan.find(p => p.name === name);
        const position = input.position ?? plannedComponent?.position ?? DEFAULT_POSITION;
        const size = input.size ?? plannedComponent?.size ?? DEFAULT_SIZE;

        // Validate component size
        const sizeError = this.validateComponentSize(name, code);
        if (sizeError) {
          return { status: 'error', message: sizeError };
        }

        // Validate component compiles correctly (catches missing imports, syntax errors, etc.)
        const compileError = validateComponent(code, name);
        if (compileError) {
          return {
            status: 'error',
            message: `Component "${name}" has errors: ${compileError}. Please fix and try again.`
          };
        }

        // Create the component file
        const result = await fileService.createProjectComponent(this.projectId, name, code);

        if (result.status !== 'success') {
          return { status: 'error', message: result.message };
        }

        // Add to canvas
        const canvasComponent: CanvasComponent = {
          id: uuidv4(),
          componentName: name,
          position,
          size
        };

        const existingCanvas = await projectService.getCanvas(this.projectId);
        existingCanvas.push(canvasComponent);
        await projectService.saveCanvas(this.projectId, existingCanvas);

        this.createdComponents.push(name);

        return {
          status: 'success',
          message: `Created component "${name}" and placed on canvas at (${position.x}, ${position.y})`,
          component_name: name,
          canvasComponent
        };
      }

      case 'read_component': {
        const { name } = toolInput as { name: string };
        const result = await fileService.readProjectComponent(this.projectId, name);

        if (result.status === 'success') {
          return {
            status: 'success',
            message: `Component '${name}' code:`,
            code: result.content,
            component_name: name,
            action: 'read'  // Mark as read action so we don't stop the loop
          };
        }
        return {
          status: result.status,
          message: result.message
        };
      }

      case 'update_component': {
        const { name, code } = toolInput as { name: string; code: string };

        // Validate component size
        const sizeError = this.validateComponentSize(name, code);
        if (sizeError) {
          return { status: 'error', message: sizeError };
        }

        // Validate component compiles correctly
        const compileError = validateComponent(code, name);
        if (compileError) {
          return {
            status: 'error',
            message: `Component "${name}" has errors: ${compileError}. Please fix and try again.`
          };
        }

        const result = await fileService.updateProjectComponent(this.projectId, name, code);
        return { ...result, component_name: result.component_name };
      }

      case 'create_interaction': {
        const input = toolInput as InteractionToolInput;
        return {
          status: 'success',
          message: 'Interaction created successfully',
          handlerName: input.handlerName,
          code: input.code,
          state: input.state,
        };
      }

      case 'create_layout': {
        const input = toolInput as CreateLayoutInput;
        const { name, layout } = input;
        const position = input.position ?? DEFAULT_POSITION;
        const size = input.size ?? { width: 800, height: 400 };

        // Extract all component names from layout and validate they exist
        const componentNames = this.extractComponentNamesFromLayout(layout);
        const missingComponents: string[] = [];

        for (const compName of componentNames) {
          const exists = await fileService.componentExists(this.projectId!, compName);
          if (!exists) {
            missingComponents.push(compName);
          }
        }

        if (missingComponents.length > 0) {
          return {
            status: 'error',
            message: `Components not found: ${missingComponents.join(', ')}. Create them first before adding to a layout.`
          };
        }

        // Save layout definition
        const result = await fileService.createLayout(this.projectId!, name, layout);

        if (result.status !== 'success') {
          return { status: 'error', message: result.message };
        }

        // Add to canvas layouts
        const canvasLayout: CanvasLayout = {
          id: uuidv4(),
          layoutName: name,
          position,
          size
        };

        // Get existing canvas and add layout
        const existingCanvas = await projectService.getCanvasWithLayouts(this.projectId!);
        existingCanvas.layouts = existingCanvas.layouts || [];
        existingCanvas.layouts.push(canvasLayout);
        await projectService.saveCanvasWithLayouts(this.projectId!, existingCanvas);

        return {
          status: 'success',
          message: `Created layout "${name}" with ${componentNames.length} components`,
          layout_name: name,
          canvasLayout,
          componentCount: componentNames.length
        };
      }

      case 'manage_todos': {
        const { todos } = toolInput as ManageTodosInput;
        return {
          status: 'success',
          message: `Updated ${todos.length} tasks`,
          todos  // Include for SSE event emission
        };
      }

      default:
        return {
          status: 'error',
          message: `Unknown tool: ${toolName}`
        };
    }
  }

  /**
   * Generate components based on user prompt
   * Can create 1 or multiple components depending on the request complexity
   */
  async *generate(prompt: string): AsyncGenerator<StreamEvent> {
    if (!this.projectId) {
      yield { type: 'error', message: 'No project context set', timestamp: Date.now() };
      return;
    }

    yield { type: 'progress', message: 'Processing request...', timestamp: Date.now() };

    // Build canvas context to inject into prompt
    const canvasContext = await this.buildCanvasContext();

    const messages = [
      {
        role: 'user' as const,
        content: `${canvasContext}

USER REQUEST: ${prompt}

Based on the complexity of this request:
- If simple (single button, card, form): Call create_component directly
- If complex (landing page, multiple elements): Call plan_components first, then create each

Start now.`
      }
    ];

    // Run agent loop - stop when we have successfully created component(s)
    // For simple requests: one create_component success
    // For complex requests: all planned components created
    yield* this.runAgentLoop(messages, (result) => {
      // Don't stop on read actions
      if (result.action === 'read') {
        return false;
      }

      // Don't stop on plan_components - need to create the components
      if (result.plan) {
        return false;
      }

      // Don't stop on manage_todos - this is just for user visibility
      if (result.todos) {
        return false;
      }

      // Success when a component is created/updated
      if (result.status === 'success' && result.component_name) {
        // If we have a pending plan, check if all components are done
        if (this.pendingPlan.length > 0) {
          const allDone = this.pendingPlan.every(p =>
            this.createdComponents.includes(p.name)
          );
          return allDone;
        }
        // No plan means single component - we're done
        return true;
      }

      return false;
    });
  }

  /**
   * Generate an interaction with streaming
   */
  async *generateInteraction(
    componentId: string,
    componentName: string,
    description: string,
    eventType: string
  ): AsyncGenerator<StreamEvent> {
    yield { type: 'progress', message: `Generating ${eventType} interaction...`, timestamp: Date.now() };

    const messages = [
      {
        role: 'user' as const,
        content: `Create a React event handler for the '${componentName}' component.

Event Type: ${eventType}
Description: ${description}

Requirements:
- Generate a clean, working event handler function
- Include any necessary state variables (using useState)
- Use TypeScript
- Follow React best practices
- The code should be ready to integrate into a React component

IMPORTANT: Use the create_interaction tool to return the handler name, code, and any state variables needed. Do not just describe it - actually call the tool.`
      }
    ];

    let capturedInteraction: Interaction | null = null;

    // Run agent loop
    for await (const event of this.runAgentLoop(messages, (result) => {
      if (result.status === 'success' && result.handlerName) {
        // Capture the interaction data
        capturedInteraction = {
          id: `${componentId}-${Date.now()}`,
          type: eventType as InteractionType,
          description,
          handlerName: String(result.handlerName),
          code: String(result.code),
          state: result.state as StateVariable[] | undefined
        };
        return true;
      }
      return false;
    })) {
      yield event;
    }

    // Return the captured interaction if successful
    if (capturedInteraction) {
      yield {
        type: 'success',
        message: 'Interaction created successfully',
        timestamp: Date.now(),
        data: { result: capturedInteraction }
      };
    }
  }
}

// Export singleton instance
export const componentAgent = new ComponentAgent();
