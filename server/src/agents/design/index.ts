import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../base';
import type { StreamEvent } from '../../../../shared/types';
import {
  ToolRegistry,
  EditComponentTool,
  ReadComponentTool,
  ManageTodosTool,
  GetLayoutTool,
  SetPageStyleTool,
  CreateLayerTool,
} from '../tools';
import { SYSTEM_PROMPT } from './prompt';
import { projectService, ConversationMessage } from '../../services/projectService';

/**
 * Create the tool registry for the design agent
 */
function createDesignToolRegistry(): ToolRegistry {
  return new ToolRegistry([
    new EditComponentTool(),
    new ReadComponentTool(),
    new ManageTodosTool(),
    new GetLayoutTool(),
    new SetPageStyleTool(),
    new CreateLayerTool(),
  ]);
}

export class DesignAgent extends BaseAgent {
  constructor() {
    super(createDesignToolRegistry(), SYSTEM_PROMPT);
  }

  /**
   * Convert stored conversation history to Claude API message format
   */
  private convertHistoryToMessages(history: ConversationMessage[]): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = [];

    for (const msg of history) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        // Reconstruct assistant message with proper content blocks
        const content: Anthropic.ContentBlockParam[] = [];

        if (msg.thinking && msg.thinkingSignature) {
          content.push({ type: 'thinking', thinking: msg.thinking, signature: msg.thinkingSignature });
        }
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.args || {},
            });
          }
        }

        if (content.length > 0) {
          messages.push({ role: 'assistant', content });
        }

        // Add tool results as user messages (required by Claude API)
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const toolResults: Anthropic.ToolResultBlockParam[] = msg.toolCalls
            .filter(tc => tc.result !== undefined)
            .map(tc => ({
              type: 'tool_result' as const,
              tool_use_id: tc.id,
              content: JSON.stringify({
                success: tc.status === 'success',
                message: tc.result,
              }),
            }));

          if (toolResults.length > 0) {
            messages.push({ role: 'user', content: toolResults });
          }
        }
      }
    }

    return messages;
  }

  /**
   * Generate components based on user prompt
   * Passes full conversation history for proper multi-turn context
   */
  async *generate(prompt: string): AsyncGenerator<StreamEvent> {
    if (!this.projectId) {
      yield { type: 'error', message: 'No project context set' };
      return;
    }

    // Get full conversation history and convert to Claude format
    const history = await projectService.getHistory(this.projectId);
    const messages = this.convertHistoryToMessages(history);

    // Append new user message
    const userContent = `${prompt}

Use get_layout first if you need to see what's on the canvas. Use edit_component to create or update components. For complex requests with multiple components, use manage_todos to track your progress.`;

    messages.push({ role: 'user', content: userContent });

    // Run agent loop with full history
    yield* this.runAgentLoop(messages);
  }
}

// Export singleton instance
export const designAgent = new DesignAgent();
