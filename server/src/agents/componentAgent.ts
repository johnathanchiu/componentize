import { v4 as uuidv4 } from 'uuid';
import { BaseAgent, type Tool, type ToolResult } from './baseAgent';
import { fileService } from '../services/fileService';
import { projectService } from '../services/projectService';
import type { StreamEvent, CanvasComponent, ComponentPlan } from '../../../shared/types';

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

POSITIONING:
- Look at CURRENT CANVAS in the user message to see existing component positions
- Place new components to avoid overlap with existing ones
- Common layout patterns:
  - Header/nav at top (y: 0-60)
  - Hero content (y: 60-200)
  - Cards in horizontal row (same y, x: 100, 400, 700)
  - Main content in middle (y: 300-500)
  - Footer at bottom (y: 600+)

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
  Maximize, Minimize, Monitor, Package, Pause, Play, Power, Printer, Radio, Save, Shield,
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

        // Store the plan
        this.pendingPlan = components.map(c => ({
          name: c.name,
          description: c.description,
          position: c.position,
          size: c.size
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
        const position = input.position ?? DEFAULT_POSITION;
        const size = input.size ?? DEFAULT_SIZE;

        // Validate component size
        const sizeError = this.validateComponentSize(name, code);
        if (sizeError) {
          return { status: 'error', message: sizeError };
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

        const result = await fileService.updateProjectComponent(this.projectId, name, code);
        return { ...result, component_name: result.component_name };
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
}

// Export singleton instance
export const componentAgent = new ComponentAgent();
