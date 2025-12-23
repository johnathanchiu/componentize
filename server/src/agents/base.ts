import Anthropic from '@anthropic-ai/sdk';
import { appConfig } from '../config';
import type { StreamEvent, CanvasComponent, AgentTodo } from '../../../shared/types';
import type { ToolRegistry, ToolSchema, ToolResult } from './tools';

/**
 * Block being accumulated during streaming
 */
interface AccumulatorBlock {
  type: 'thinking' | 'text' | 'tool_use';
  content: string;
  toolName?: string;
  toolId?: string;
}

/**
 * Base Agent class with simplified streaming and ToolRegistry
 *
 * Streaming model:
 * - thinking_delta / text_delta → emit immediately (user sees Claude think)
 * - tool_use → accumulate silently until block completes, then execute and emit tool_result
 * - tool_result embeds canvas/todo updates (no separate event types)
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

  /**
   * Get tool schemas for the Anthropic API
   */
  protected getToolSchemas(): ToolSchema[] {
    return this.registry.getSchemas();
  }

  /**
   * Simplified agent loop with block-indexed accumulator
   *
   * Events emitted:
   * - thinking_delta: { content, blockIndex } - emit immediately
   * - text_delta: { content, blockIndex } - emit immediately
   * - tool_result: { blockIndex, name, result } - after tool executes (embeds canvas/todo)
   * - complete: { status, message } - when done
   * - error: { message } - on failure
   */
  protected async *runAgentLoop(
    messages: Anthropic.MessageParam[]
  ): AsyncGenerator<StreamEvent> {
    let iteration = 0;

    // Block accumulator - tracks content by block index
    const blocks = new Map<number, AccumulatorBlock>();

    while (iteration < appConfig.api.maxIterations) {
      iteration++;

      // Emit turn_start at the beginning of each agent turn
      yield {
        type: 'turn_start',
        message: `Starting turn ${iteration}`,
        timestamp: Date.now(),
        data: { iteration }
      };

      try {
        const stream = this.client.messages.stream({
          model: appConfig.api.modelName,
          max_tokens: appConfig.api.maxTokens,
          system: this.systemPrompt,
          tools: this.getToolSchemas(),
          tool_choice: { type: 'auto' },
          messages,
          thinking: {
            type: 'enabled',
            budget_tokens: 10000,
          },
        });

        // Track tool calls to execute after streaming
        const pendingToolCalls: Array<{
          index: number;
          id: string;
          name: string;
          input: unknown;
        }> = [];

        // Process streaming events
        for await (const event of stream) {
          const timestamp = Date.now();

          switch (event.type) {
            case 'content_block_start': {
              const index = event.index;
              const block = event.content_block;

              if (block.type === 'thinking') {
                blocks.set(index, { type: 'thinking', content: '' });
              } else if (block.type === 'text') {
                blocks.set(index, { type: 'text', content: '' });
              } else if (block.type === 'tool_use') {
                blocks.set(index, {
                  type: 'tool_use',
                  content: '',
                  toolName: block.name,
                  toolId: block.id,
                });
              }
              break;
            }

            case 'content_block_delta': {
              const index = event.index;
              const block = blocks.get(index);
              if (!block) break;

              if (event.delta.type === 'thinking_delta') {
                const delta = (event.delta as { thinking: string }).thinking;
                block.content += delta;

                // Emit immediately - user sees thinking
                yield {
                  type: 'thinking_delta',
                  message: delta,
                  timestamp,
                  data: { content: delta, blockIndex: index }
                };
              } else if (event.delta.type === 'text_delta') {
                const delta = event.delta.text;
                block.content += delta;

                // Emit immediately - user sees response
                yield {
                  type: 'text_delta',
                  message: delta,
                  timestamp,
                  data: { content: delta, blockIndex: index }
                };
              } else if (event.delta.type === 'input_json_delta') {
                // Accumulate tool input silently - no streaming needed
                block.content += event.delta.partial_json;
              }
              break;
            }

            case 'content_block_stop': {
              const index = event.index;
              const block = blocks.get(index);
              if (!block) break;

              // If tool_use block completed, queue for execution
              if (block.type === 'tool_use' && block.toolId && block.toolName) {
                try {
                  const input = JSON.parse(block.content || '{}');
                  pendingToolCalls.push({
                    index,
                    id: block.toolId,
                    name: block.toolName,
                    input,
                  });
                } catch {
                  // JSON parse error - skip this tool call
                  console.error('Failed to parse tool input:', block.content);
                }
              }
              break;
            }
          }
        }

        // Get final message after streaming
        const response = await stream.finalMessage();

        // Execute all tool calls via registry and emit results
        const toolResults: Array<{ id: string; result: ToolResult }> = [];

        for (const toolCall of pendingToolCalls) {
          // Emit tool_call event BEFORE execution
          yield {
            type: 'tool_call',
            message: `Calling ${toolCall.name}`,
            timestamp: Date.now(),
            data: {
              toolUseId: toolCall.id,
              toolName: toolCall.name,
              toolInput: toolCall.input as Record<string, unknown>,
              blockIndex: toolCall.index,
            }
          };

          if (!this.projectId) {
            const errorResult: ToolResult = { success: false, error: 'No project context set' };
            toolResults.push({ id: toolCall.id, result: errorResult });
            continue;
          }

          const result = await this.registry.execute(
            toolCall.name,
            toolCall.input,
            { projectId: this.projectId }
          );
          toolResults.push({ id: toolCall.id, result });

          // Emit tool_result with embedded canvas/todo updates
          yield {
            type: 'tool_result',
            message: result.output || result.error || '',
            timestamp: Date.now(),
            data: {
              blockIndex: toolCall.index,
              toolName: toolCall.name,
              toolUseId: toolCall.id,
              status: result.success ? 'success' : 'error',
              result: {
                status: result.success ? 'success' : 'error',
                message: result.output || result.error || '',
                ...result,
              },
              // Embed canvas update if present
              canvasComponent: result.canvasUpdate as CanvasComponent | undefined,
              // Embed todo update if present
              todos: result.todosUpdate as AgentTodo[] | undefined,
            }
          };
        }

        // Handle response based on stop reason
        if (response.stop_reason === 'tool_use') {
          // Continue the loop - add assistant message and tool results
          if (response.content && response.content.length > 0) {
            messages.push({
              role: 'assistant',
              content: response.content,
            });
          }

          // Add tool results as user message
          const toolResultMessages: Anthropic.MessageParam[] = toolResults.map(tr => ({
            role: 'user' as const,
            content: [{
              type: 'tool_result' as const,
              tool_use_id: tr.id,
              content: JSON.stringify({
                status: tr.result.success ? 'success' : 'error',
                message: tr.result.output || tr.result.error || '',
              }),
            }],
          }));

          messages.push(...toolResultMessages);

          // Clear blocks for next iteration
          blocks.clear();

        } else if (response.stop_reason === 'end_turn') {
          // Claude is done - natural completion
          const finalText = response.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map(block => block.text)
            .join('\n')
            .trim();

          yield {
            type: 'complete',
            message: finalText || 'Task completed',
            timestamp: Date.now(),
            data: {
              status: 'success',
              content: finalText,
            }
          };
          return;

        } else if (response.stop_reason === 'max_tokens') {
          // Response truncated - ask for simpler approach
          messages.push({
            role: 'user',
            content: 'Your response was too long. Please try a simpler approach with smaller components.',
          });
          blocks.clear();

        } else {
          // Other stop reason - treat as completion
          yield {
            type: 'complete',
            message: `Task ended: ${response.stop_reason}`,
            timestamp: Date.now(),
            data: { status: 'success' }
          };
          return;
        }

      } catch (error) {
        yield {
          type: 'error',
          message: `API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
        };
        return;
      }
    }

    // Max iterations reached
    yield {
      type: 'complete',
      message: 'Max iterations reached',
      timestamp: Date.now(),
      data: { status: 'error', reason: 'max_iterations' }
    };
  }

  /**
   * Helper to extract text from Claude response
   */
  protected extractText(content: Anthropic.ContentBlock[]): string {
    return content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');
  }
}
