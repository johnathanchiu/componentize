import Anthropic from '@anthropic-ai/sdk';
import { appConfig } from '../config';
import type { StreamEvent } from '../../../shared/types';

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolResult {
  status: 'success' | 'error';
  message: string;
  [key: string]: any;
}

/**
 * Base Agent class with common streaming logic
 * All agents extend this to avoid code duplication
 */
export abstract class BaseAgent {
  protected client: Anthropic;
  protected tools: Tool[];

  constructor(tools: Tool[]) {
    this.client = new Anthropic({
      apiKey: appConfig.api.anthropicApiKey,
    });
    this.tools = tools;
  }

  /**
   * Execute a tool call - must be implemented by subclasses
   */
  protected abstract executeTool(toolName: string, toolInput: any): Promise<ToolResult>;

  /**
   * Common agent loop with streaming
   * Yields progress events as the agent works
   */
  protected async *runAgentLoop(
    messages: Anthropic.MessageParam[],
    onSuccess: (result: any) => boolean  // Return true if we should stop
  ): AsyncGenerator<StreamEvent> {
    let iteration = 0;

    yield { type: 'progress', message: 'Starting AI agent...' };

    while (iteration < appConfig.api.maxIterations) {
      iteration++;

      yield {
        type: 'progress',
        message: `Agent iteration ${iteration}/${appConfig.api.maxIterations}...`
      };

      try {
        // Call Claude API
        const response = await this.client.messages.create({
          model: appConfig.api.modelName,
          max_tokens: appConfig.api.maxTokens,
          tools: this.tools,
          messages,
        });

        // Handle tool use
        if (response.stop_reason === 'tool_use') {
          // Add assistant response to messages
          messages.push({
            role: 'assistant',
            content: response.content,
          });

          // Process tool calls
          const toolResults: Anthropic.MessageParam[] = [];

          for (const contentBlock of response.content) {
            if (contentBlock.type === 'tool_use') {
              const { name: toolName, input: toolInput, id: toolUseId } = contentBlock;

              yield { type: 'tool_call', message: `Calling tool: ${toolName}...` };

              // Execute the tool
              const result = await this.executeTool(toolName, toolInput);

              // Add tool result
              toolResults.push({
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: toolUseId,
                  content: JSON.stringify(result),
                }],
              });

              // Check if this tool call indicates success
              if (onSuccess(result)) {
                yield { type: 'success', message: result.message };
                return;
              }
            }
          }

          // Add tool results to messages
          messages.push(...toolResults);

        } else if (response.stop_reason === 'end_turn') {
          // Claude finished without using tools
          // Prompt it to use tools
          messages.push({
            role: 'assistant',
            content: response.content,
          });

          messages.push({
            role: 'user',
            content: 'Please use the appropriate tool to save your work. Don\'t just describe it - actually call the tool with the code.',
          });

          yield { type: 'progress', message: 'Prompting agent to use tool...' };

        } else {
          // Other stop reason
          yield {
            type: 'error',
            message: `Agent stopped unexpectedly: ${response.stop_reason}`
          };
          return;
        }

      } catch (error) {
        yield {
          type: 'error',
          message: `API error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
        return;
      }
    }

    // Max iterations reached
    yield {
      type: 'error',
      message: 'Operation exceeded maximum iterations'
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
