import Anthropic from '@anthropic-ai/sdk';
import { appConfig } from '../config';
import type { StreamEvent, CanvasComponent, AgentTodo } from '../../../shared/types';

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolResult {
  status: 'success' | 'error';
  message: string;
  [key: string]: unknown;
}

/**
 * Base Agent class with streaming support
 * All agents extend this to avoid code duplication
 */
export abstract class BaseAgent {
  protected client: Anthropic;
  protected tools: Tool[];
  protected systemPrompt: string;

  constructor(tools: Tool[], systemPrompt?: string) {
    this.client = new Anthropic({
      apiKey: appConfig.api.anthropicApiKey,
    });
    this.tools = tools;
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt();
  }

  /**
   * Default system prompt that encourages tool use
   */
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
   * Execute a tool call - must be implemented by subclasses
   */
  protected abstract executeTool(toolName: string, toolInput: unknown): Promise<ToolResult>;

  /**
   * Determine if we should emit a thinking chunk
   * Strategy: Emit on sentence boundaries or after significant content
   */
  private shouldEmitThinkingChunk(text: string): boolean {
    // Emit if we have a complete sentence
    const sentenceEnders = ['.', '!', '?', ':'];
    const lastChar = text.trim().slice(-1);
    if (sentenceEnders.includes(lastChar) && text.length > 20) {
      return true;
    }

    // Emit if we have a newline (paragraph break)
    if (text.includes('\n') && text.length > 10) {
      return true;
    }

    // Emit if accumulated text is getting long (buffer limit)
    if (text.length > 150) {
      return true;
    }

    return false;
  }

  /**
   * Sanitize tool input for streaming events
   * Truncate large fields like 'code' to avoid sending huge events
   */
  private sanitizeToolInput(input: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...input };

    // Truncate code fields for display
    if (sanitized.code && typeof sanitized.code === 'string') {
      const lines = sanitized.code.split('\n');
      if (lines.length > 5) {
        sanitized.code = `${lines.slice(0, 5).join('\n')}\n... (${lines.length - 5} more lines)`;
      }
    }

    return sanitized;
  }

  /**
   * Common agent loop with real streaming
   * Yields progress events as the agent works, including Claude's thinking
   *
   * Uses delta-based streaming pattern:
   * - turn_start: New iteration starting
   * - thinking_delta: Incremental text tokens
   * - tool_call: Tool being invoked
   * - tool_result: Tool execution result
   * - complete: Task finished (success or error)
   */
  protected async *runAgentLoop(
    messages: Anthropic.MessageParam[],
    onSuccess: (result: ToolResult) => boolean  // Return true if we should stop
  ): AsyncGenerator<StreamEvent> {
    let iteration = 0;

    while (iteration < appConfig.api.maxIterations) {
      iteration++;

      // Emit turn_start at the beginning of each iteration
      yield {
        type: 'turn_start',
        message: `Starting iteration ${iteration}`,
        timestamp: Date.now(),
        data: { iteration, maxIterations: appConfig.api.maxIterations }
      };

      try {
        // Create streaming request with system prompt and extended thinking
        // Always use 'auto' tool_choice - let Claude decide when to use tools
        const stream = this.client.messages.stream({
          model: appConfig.api.modelName,
          max_tokens: appConfig.api.maxTokens,
          system: this.systemPrompt,
          tools: this.tools,
          tool_choice: { type: 'auto' },
          messages,
          // Enable extended thinking for separate thinking/text streams
          thinking: {
            type: 'enabled',
            budget_tokens: 10000,  // Medium budget for thinking
          },
        });

        // Track state during streaming
        let accumulatedText = '';
        let currentToolUse: { id: string; name: string; inputJson: string } | null = null;
        const pendingToolUses: Array<{ id: string; name: string; input: unknown; result?: ToolResult; shouldExit?: boolean }> = [];
        let lastCodeStreamTime = 0;
        const CODE_STREAM_INTERVAL = 100; // Emit code chunks every 100ms

        // Track current block type for extended thinking
        let currentBlockType: 'thinking' | 'text' | 'tool_use' | null = null;

        // Process streaming events
        for await (const event of stream) {
          const timestamp = Date.now();

          switch (event.type) {
            case 'content_block_start':
              // Handle extended thinking block types
              if (event.content_block.type === 'thinking') {
                // Thinking block starting - Claude's internal reasoning
                currentBlockType = 'thinking';
                accumulatedText = '';
              } else if (event.content_block.type === 'text') {
                // Text block starting - Claude's response to user
                currentBlockType = 'text';
                accumulatedText = '';
              } else if (event.content_block.type === 'tool_use') {
                // Tool use block starting - emit tool_call event
                currentBlockType = 'tool_use';
                currentToolUse = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  inputJson: '',
                };
                yield {
                  type: 'tool_call',
                  message: `Calling ${event.content_block.name}...`,
                  timestamp,
                  data: {
                    toolName: event.content_block.name,
                    toolUseId: event.content_block.id,
                  }
                };
              }
              break;

            case 'content_block_delta':
              // Handle extended thinking deltas
              if (event.delta.type === 'thinking_delta') {
                // Claude's internal thinking - emit as thinking_delta
                const delta = (event.delta as { thinking: string }).thinking;
                accumulatedText += delta;
                yield {
                  type: 'thinking_delta',
                  message: delta,
                  timestamp,
                  data: { content: delta }
                };
              } else if (event.delta.type === 'text_delta') {
                // Claude's response text - emit as text_delta (separate from thinking)
                const delta = event.delta.text;
                accumulatedText += delta;
                yield {
                  type: 'text_delta',
                  message: delta,
                  timestamp,
                  data: { content: delta }
                };
              } else if (event.delta.type === 'input_json_delta') {
                // Tool input is being streamed - emit code chunks periodically
                if (currentToolUse) {
                  currentToolUse.inputJson += event.delta.partial_json;

                  // Emit code streaming events periodically for better UX
                  if (timestamp - lastCodeStreamTime > CODE_STREAM_INTERVAL) {
                    // Try to extract code from partial JSON
                    const codeMatch = currentToolUse.inputJson.match(/"code"\s*:\s*"([^"]*)/);
                    if (codeMatch && codeMatch[1]) {
                      // Unescape the JSON string
                      const partialCode = codeMatch[1]
                        .replace(/\\n/g, '\n')
                        .replace(/\\t/g, '\t')
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\');

                      yield {
                        type: 'code_delta',
                        message: 'Generating code...',
                        timestamp,
                        data: {
                          toolName: currentToolUse.name,
                          partialCode,
                          lineCount: partialCode.split('\n').length,
                        }
                      };
                    }
                    lastCodeStreamTime = timestamp;
                  }
                }
              }
              break;

            case 'content_block_stop':
              // Reset accumulators and block type
              accumulatedText = '';
              currentBlockType = null;

              // If we finished a tool use block, parse and EXECUTE immediately
              // This enables incremental canvas updates during streaming
              if (currentToolUse) {
                try {
                  const toolInput = JSON.parse(currentToolUse.inputJson || '{}');

                  // Emit final code event with complete code
                  if (toolInput.code) {
                    yield {
                      type: 'code_complete',
                      message: 'Code generation complete',
                      timestamp,
                      data: {
                        toolName: currentToolUse.name,
                        code: toolInput.code,
                        lineCount: toolInput.code.split('\n').length,
                        componentName: toolInput.name,
                      }
                    };
                  }

                  // Execute tool IMMEDIATELY during streaming for incremental updates
                  const result = await this.executeTool(currentToolUse.name, toolInput);

                  // Store for later message construction
                  pendingToolUses.push({
                    id: currentToolUse.id,
                    name: currentToolUse.name,
                    input: toolInput,
                    result, // Store the result too
                  });

                  // Emit tool result event immediately
                  yield {
                    type: 'tool_result',
                    message: result.message,
                    timestamp: Date.now(),
                    data: {
                      toolName: currentToolUse.name,
                      toolUseId: currentToolUse.id,
                      status: result.status,
                      result: result,
                    }
                  };

                  // Emit canvas_update event immediately if component was added
                  if (result.canvasComponent) {
                    yield {
                      type: 'canvas_update',
                      message: `Added ${result.component_name} to canvas`,
                      timestamp: Date.now(),
                      data: {
                        canvasComponent: result.canvasComponent as CanvasComponent,
                      }
                    };
                  }

                  // Emit todo_update event if tool result contains todos
                  if (result.todos) {
                    yield {
                      type: 'todo_update',
                      message: 'Tasks updated',
                      timestamp: Date.now(),
                      data: {
                        todos: result.todos as AgentTodo[],
                      }
                    };
                  }

                  // Check if this tool call indicates success (early exit)
                  if (onSuccess(result)) {
                    // Mark that we should exit after stream completes
                    pendingToolUses[pendingToolUses.length - 1].shouldExit = true;
                  }
                } catch {
                  // JSON parse error - skip
                }
                currentToolUse = null;
              }
              break;
          }
        }

        // Get final message after streaming completes
        const response = await stream.finalMessage();

        // Handle tool use - tools were already executed during streaming
        if (response.stop_reason === 'tool_use') {
          // Add assistant response to messages (only if content is non-empty)
          if (response.content && response.content.length > 0) {
            messages.push({
              role: 'assistant',
              content: response.content,
            });
          }

          // Check if any tool execution triggered early exit
          const exitTool = pendingToolUses.find(t => t.shouldExit);
          if (exitTool && exitTool.result) {
            yield {
              type: 'success',
              message: exitTool.result.message,
              timestamp: Date.now(),
              data: { result: exitTool.result }
            };
            return;
          }

          // Build tool result messages from already-executed tools
          const toolResults: Anthropic.MessageParam[] = pendingToolUses
            .filter(t => t.result)
            .map(t => ({
              role: 'user' as const,
              content: [{
                type: 'tool_result' as const,
                tool_use_id: t.id,
                content: JSON.stringify(t.result),
              }],
            }));

          // Add tool results to messages
          messages.push(...toolResults);

        } else if (response.stop_reason === 'max_tokens') {
          // Response was truncated - DON'T add the incomplete response
          // Instead, ask for a simpler approach
          messages.push({
            role: 'user',
            content: 'Your previous response was too long and got truncated. Please try again with a SIMPLER approach. Remember: components must be ATOMIC and under 50 lines. Create a minimal component with fewer features.',
          });

          yield {
            type: 'progress',
            message: 'Response too long, requesting simpler approach...',
            timestamp: Date.now(),
          };

        } else if (response.stop_reason === 'end_turn') {
          // CLAUDE IS DONE - natural completion
          // end_turn means Claude has finished its response without calling tools
          // This is the correct way for the agent to signal task completion

          // Extract any final text message from Claude
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
          return; // EXIT LOOP - task is done

        } else if (response.stop_reason === 'stop_sequence') {
          // User-defined stop sequence hit - treat as completion
          yield {
            type: 'complete',
            message: 'Task completed (stop sequence)',
            timestamp: Date.now(),
            data: { status: 'success' }
          };
          return;

        } else {
          // Other unexpected stop reason
          yield {
            type: 'error',
            message: `Agent stopped unexpectedly: ${response.stop_reason}`,
            timestamp: Date.now(),
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
