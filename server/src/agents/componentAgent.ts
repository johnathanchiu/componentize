import { BaseAgent, type Tool, type ToolResult } from './baseAgent';
import { fileService } from '../services/fileService';
import type { StreamEvent } from '../../../shared/types';

const COMPONENT_TOOLS: Tool[] = [
  {
    name: 'create_component',
    description: 'Create a new React TypeScript component file with Tailwind CSS styling. Use this for new components.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Component name in PascalCase (e.g., Button, PricingCard, HeroSection)'
        },
        code: {
          type: 'string',
          description: 'The complete React TypeScript component code including imports, types, and export'
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

const COMPONENT_SYSTEM_PROMPT = `You are an expert React/TypeScript developer. Your ONLY job is to write and modify React components.

CRITICAL RULES - FOLLOW EXACTLY:
1. ALWAYS use tools. Never respond with just text.
2. When creating: call create_component with the complete code.
3. When editing: first call read_component, then call update_component with the COMPLETE updated code.
4. When fixing errors: read the component, identify the bug, fix it, and save with update_component.
5. NEVER ask questions. Make reasonable decisions and proceed.
6. NEVER explain what you'll do. Just do it.
7. Write working code on the first attempt.

CODE REQUIREMENTS:
- TypeScript with proper types (no 'any' unless necessary)
- Tailwind CSS for all styling (no inline styles, no CSS files)
- Functional components with hooks
- Accessible (aria-labels, semantic HTML)
- Export as default
- Handle edge cases (loading, error, empty states)

SHADCN/UI COMPONENTS AVAILABLE:
You have access to the following pre-installed shadcn/ui components. Use them to create beautiful, polished UIs:
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

Prefer these components over raw HTML when appropriate for a polished look.

SHARED STATE (Inter-Component Communication):
Use useSharedState to share state between components on the canvas. This allows components to communicate with each other.

Usage:
  const [value, setValue] = useSharedState('keyName', defaultValue);

Examples:
  // Counter that can be controlled by multiple components
  const [count, setCount] = useSharedState('counter', 0);

  // Shared toggle state
  const [isOpen, setIsOpen] = useSharedState('menuOpen', false);

  // Read-only access (only destructure first element)
  const [count] = useSharedState('counter', 0);

When the user wants components to interact with each other (e.g., "button controls display", "toggle affects other component"), use useSharedState with a descriptive key name.`;

export class ComponentAgent extends BaseAgent {
  private projectId: string | null = null;

  constructor() {
    super(COMPONENT_TOOLS, COMPONENT_SYSTEM_PROMPT);
  }

  /**
   * Set the project context for subsequent operations
   */
  setProjectContext(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Clear the project context
   */
  clearProjectContext(): void {
    this.projectId = null;
  }

  protected async executeTool(toolName: string, toolInput: unknown): Promise<ToolResult> {
    switch (toolName) {
      case 'create_component': {
        const { name, code } = toolInput as { name: string; code: string };
        // Use project-scoped method if projectId is set
        const result = this.projectId
          ? await fileService.createProjectComponent(this.projectId, name, code)
          : await fileService.createComponent(name, code);
        return { ...result, component_name: result.component_name };
      }

      case 'read_component': {
        const { name } = toolInput as { name: string };
        // Use project-scoped method if projectId is set
        const result = this.projectId
          ? await fileService.readProjectComponent(this.projectId, name)
          : await fileService.readComponent(name);
        if (result.status === 'success') {
          return {
            status: 'success',
            message: `Component '${name}' code:`,
            code: result.content,
            component_name: name,
            action: 'read',  // Mark as read action so we don't stop the loop
          };
        }
        return {
          status: result.status,
          message: result.message,
        };
      }

      case 'update_component': {
        const { name, code } = toolInput as { name: string; code: string };
        // Use project-scoped method if projectId is set
        const result = this.projectId
          ? await fileService.updateProjectComponent(this.projectId, name, code)
          : await fileService.updateComponent(name, code);
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
   * Generate a new component with streaming
   */
  async *generateComponent(prompt: string, componentName: string): AsyncGenerator<StreamEvent> {
    yield { type: 'progress', message: `Creating '${componentName}'...`, timestamp: Date.now() };

    const messages = [
      {
        role: 'user' as const,
        content: `Create component "${componentName}": ${prompt}

Call create_component now.`
      }
    ];

    // Run agent loop
    yield* this.runAgentLoop(messages, (result) => {
      return result.status === 'success' && result.component_name === componentName;
    });
  }

  /**
   * Edit an existing component with streaming
   */
  async *editComponent(componentName: string, editDescription: string): AsyncGenerator<StreamEvent> {
    yield { type: 'progress', message: `Editing '${componentName}'...`, timestamp: Date.now() };

    // Check component exists (use project-scoped method if projectId is set)
    const exists = this.projectId
      ? await fileService.readProjectComponent(this.projectId, componentName)
      : await fileService.readComponent(componentName);
    if (exists.status !== 'success') {
      yield { type: 'error', message: `Component '${componentName}' not found`, timestamp: Date.now() };
      return;
    }

    const messages = [
      {
        role: 'user' as const,
        content: `Edit component "${componentName}": ${editDescription}

Steps:
1. Call read_component to get current code
2. Fix the issue
3. Call update_component with the complete fixed code

Start now.`
      }
    ];

    // Run agent loop - only stop on successful update, not on read
    yield* this.runAgentLoop(messages, (result) => {
      return result.status === 'success' &&
             result.component_name === componentName &&
             result.action !== 'read';
    });
  }
}

// Export singleton instance
export const componentAgent = new ComponentAgent();
