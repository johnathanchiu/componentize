import Anthropic from '@anthropic-ai/sdk';
import { appConfig } from '../config';
import type { StreamEvent, CanvasComponent, AgentTodo, LayoutState } from '../../../shared/types';
import type { ToolRegistry, ToolSchema, ToolResult } from './tools';

interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

interface StreamResult {
  response: Anthropic.Message;
  toolCalls: ToolCall[];
  thinkingSignature?: string;
}

/**
 * Base Agent class with clean streaming architecture
 */
export abstract class BaseAgent {
  protected client: Anthropic;
  protected registry: ToolRegistry;
  protected systemPrompt: string;
  protected projectId: string | null = null;

  constructor(registry: ToolRegistry, systemPrompt?: string) {
    this.client = new Anthropic({
      apiKey: appConfig.api.anthropicApiKey,
    });
    this.registry = registry;
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt();
  }

  private getDefaultSystemPrompt(): string {
    return `You are an expert React/TypeScript developer assistant. Your job is to write high-quality code.

CRITICAL INSTRUCTIONS:
1. You MUST use tools to complete tasks. Never just describe what you would do - actually do it by calling tools.
2. When asked to create or modify code, ALWAYS call the appropriate tool with the complete code.
3. Do NOT ask clarifying questions. Make reasonable decisions and proceed.
4. Do NOT explain what you're going to do before doing it. Just do it.
5. Write clean, working code on the first try.

When writing React components:
- Use TypeScript with proper type definitions
- Use Tailwind CSS for styling (no CSS files)
- Use functional components with hooks
- Make components accessible (aria labels, semantic HTML)
- Export the component as default`;
  }

  setProjectContext(projectId: string): void {
    this.projectId = projectId;
  }

  clearProjectContext(): void {
    this.projectId = null;
  }

  protected getToolSchemas(): ToolSchema[] {
    return this.registry.getSchemas();
  }

  /**
   * Main agent loop - clean and simple
   */
  protected async *runAgentLoop(
    messages: Anthropic.MessageParam[]
  ): AsyncGenerator<StreamEvent> {
    for (let i = 0; i < appConfig.api.maxIterations; i++) {
      try {
        // Stream response, yield events, collect tool calls
        const { response, toolCalls } = yield* this.streamResponse(messages);

        // Execute tools and yield results
        const toolResults = yield* this.executeTools(toolCalls);

        // Handle based on stop reason
        if (response.stop_reason === 'end_turn') {
          yield { type: 'complete', content: this.extractText(response.content) || undefined };
          return;
        }

        if (response.stop_reason === 'tool_use') {
          messages.push({ role: 'assistant', content: response.content });
          messages.push(...this.buildToolResultMessages(toolResults));
          continue;
        }

        if (response.stop_reason === 'max_tokens') {
          messages.push({
            role: 'user',
            content: 'Your response was too long. Please try a simpler approach.',
          });
          continue;
        }

        // Other stop reasons
        yield { type: 'complete' };
        return;

      } catch (error) {
        yield { type: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
        return;
      }
    }

    yield { type: 'error', message: 'Max iterations reached' };
  }

  /**
   * Stream response from Claude, yield events, collect tool calls
   */
  private async *streamResponse(
    messages: Anthropic.MessageParam[]
  ): AsyncGenerator<StreamEvent, StreamResult, undefined> {
    const stream = this.client.messages.stream({
      model: appConfig.api.modelName,
      max_tokens: appConfig.api.maxTokens,
      system: this.systemPrompt,
      tools: this.getToolSchemas(),
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      messages,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000,
      },
    });

    const toolCalls: ToolCall[] = [];
    let currentTool: { id: string; name: string; input: string } | null = null;
    let thinkingSignature: string | undefined;

    for await (const event of stream) {
      // Thinking block start - capture and yield signature for history storage
      if (event.type === 'content_block_start' && event.content_block.type === 'thinking') {
        // The SDK types don't include 'signature' on ThinkingBlock, but it's present at runtime
        const thinkingBlock = event.content_block as { type: 'thinking'; thinking: string; signature?: string };
        thinkingSignature = thinkingBlock.signature;
        if (thinkingSignature) {
          yield { type: 'thinking_signature', signature: thinkingSignature };
        }
      }

      // Tool use start
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        currentTool = { id: event.content_block.id, name: event.content_block.name, input: '' };
      }

      // Content deltas
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'thinking_delta') {
          yield { type: 'thinking', content: (delta as { thinking: string }).thinking };
        } else if (delta.type === 'text_delta') {
          yield { type: 'text', content: delta.text };
        } else if (delta.type === 'input_json_delta' && currentTool) {
          currentTool.input += delta.partial_json;
        }
      }

      // Tool use complete
      if (event.type === 'content_block_stop' && currentTool) {
        try {
          const input = JSON.parse(currentTool.input || '{}');
          toolCalls.push({ id: currentTool.id, name: currentTool.name, input });
          yield { type: 'tool_call', id: currentTool.id, name: currentTool.name, input };
        } catch {
          console.error('Failed to parse tool input:', currentTool.input);
        }
        currentTool = null;
      }
    }

    return { response: await stream.finalMessage(), toolCalls, thinkingSignature };
  }

  /**
   * Execute tool calls and yield results
   */
  private async *executeTools(
    toolCalls: ToolCall[]
  ): AsyncGenerator<StreamEvent, Array<{ id: string; result: ToolResult }>, undefined> {
    const results: Array<{ id: string; result: ToolResult }> = [];

    for (const toolCall of toolCalls) {
      if (!this.projectId) {
        const errorResult: ToolResult = { success: false, error: 'No project context set' };
        results.push({ id: toolCall.id, result: errorResult });
        yield {
          type: 'tool_result',
          id: toolCall.id,
          name: toolCall.name,
          success: false,
          output: errorResult.error,
        };
        continue;
      }

      const result = await this.registry.execute(
        toolCall.name,
        toolCall.input,
        { projectId: this.projectId }
      );
      results.push({ id: toolCall.id, result });

      yield {
        type: 'tool_result',
        id: toolCall.id,
        name: toolCall.name,
        success: result.success,
        output: result.output || result.error,
        canvas: result.canvasUpdate as CanvasComponent | undefined,
        canvasUpdates: result.canvasUpdates as CanvasComponent[] | undefined,
        todos: result.todosUpdate as AgentTodo[] | undefined,
        layout: result.layoutUpdate as LayoutState | undefined,
      };
    }

    return results;
  }

  /**
   * Build tool result messages for Claude API
   */
  private buildToolResultMessages(
    results: Array<{ id: string; result: ToolResult }>
  ): Anthropic.MessageParam[] {
    return results.map(({ id, result }) => ({
      role: 'user' as const,
      content: [{
        type: 'tool_result' as const,
        tool_use_id: id,
        content: JSON.stringify({
          success: result.success,
          message: result.output || result.error || '',
        }),
      }],
    }));
  }

  /**
   * Extract text from Claude response content
   */
  protected extractText(content: Anthropic.ContentBlock[]): string {
    return content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();
  }
}
