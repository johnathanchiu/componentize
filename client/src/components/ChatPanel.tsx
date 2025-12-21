import { useState, useEffect, useRef } from 'react';
import { Brain, ChevronDown, Check, X, Loader2 } from 'lucide-react';
import { useGenerationStore, type ConversationMessage, type ToolCallState } from '../store/generationStore';
import { cn } from '../lib/utils';

// Helper to get human-readable tool labels
function getToolLabel(toolName: string, args?: unknown): string {
  const argsObj = args as Record<string, unknown> | undefined;

  switch (toolName) {
    case 'create_component':
    case 'update_component':
      const compName = argsObj?.componentName as string;
      return toolName === 'create_component'
        ? `Created ${compName || 'component'}`
        : `Updated ${compName || 'component'}`;
    case 'read_component':
      return `Read ${argsObj?.componentName || 'component'}`;
    case 'list_components':
      return 'Listed components';
    case 'update_todos':
      return 'Updated tasks';
    default:
      return toolName.replace(/_/g, ' ');
  }
}

// Thinking indicator while waiting for response
function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-neutral-500">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span className="text-sm">Thinking...</span>
    </div>
  );
}

// Check if this is a fix prompt and extract component name
function parseFixPrompt(content: string): { isFixPrompt: boolean; componentName?: string; errorMessage?: string } {
  const fixMatch = content.match(/^Fix this runtime error in component "([^"]+)":\s*\n\nERROR: ([^\n]+)/);
  if (fixMatch) {
    return {
      isFixPrompt: true,
      componentName: fixMatch[1],
      errorMessage: fixMatch[2],
    };
  }
  return { isFixPrompt: false };
}

// User message bubble
function UserMessage({ content }: { content: string }) {
  const fixInfo = parseFixPrompt(content);

  // Render fix prompts with a cleaner format
  if (fixInfo.isFixPrompt) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm">
        <div className="flex items-center gap-2 text-orange-700 font-medium">
          <span>Fixing: {fixInfo.componentName}</span>
        </div>
        <div className="mt-1 text-orange-600 text-xs">
          Error: {fixInfo.errorMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-100 rounded-lg px-3 py-2 text-sm text-neutral-900">
      {content}
    </div>
  );
}

// Collapsible thought display
function ThoughtDisplay({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [isOpen, setIsOpen] = useState(true); // Start open to show streaming

  // Auto-collapse when streaming stops
  useEffect(() => {
    if (!isStreaming && content) {
      // Keep open while streaming, could auto-collapse after
    }
  }, [isStreaming, content]);

  if (!content) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
      >
        <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
        <Brain className="w-3 h-3" />
        <span className={isStreaming ? "animate-pulse" : ""}>
          Thought process
        </span>
      </button>

      {isOpen && (
        <div className="mt-1 pl-4 border-l-2 border-neutral-200 text-xs text-neutral-600 leading-relaxed whitespace-pre-wrap break-words">
          {content}
          {isStreaming && <span className="inline-block w-1.5 h-3 bg-neutral-400 animate-pulse ml-0.5 align-text-bottom" />}
        </div>
      )}
    </div>
  );
}

// Tool call display with status
function ToolCallDisplay({ toolCall }: { toolCall: ToolCallState }) {
  const { name, status, result, args } = toolCall;
  const [isOpen, setIsOpen] = useState(status === 'error');

  const Icon = status === 'pending' ? Loader2
             : status === 'success' ? Check
             : X;

  const iconColor = status === 'pending' ? 'text-neutral-400'
                  : status === 'success' ? 'text-green-500'
                  : 'text-red-500';

  const label = getToolLabel(name, args);

  return (
    <div className="text-sm py-1">
      <button
        onClick={() => result && setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 text-neutral-600 hover:text-neutral-800 transition-colors",
          !result && "cursor-default"
        )}
        disabled={!result}
      >
        <Icon className={cn("w-3.5 h-3.5", iconColor, status === 'pending' && "animate-spin")} />
        <span className="font-medium">{label}</span>
      </button>

      {isOpen && result !== undefined && (
        <pre className={cn(
          "mt-1 p-2 rounded text-xs overflow-auto max-h-48",
          status === 'error' ? "bg-red-50 text-red-700" : "bg-neutral-50 text-neutral-600"
        )}>
          {typeof result === 'string' ? result : JSON.stringify(result as Record<string, unknown>, null, 2)}
        </pre>
      )}
    </div>
  );
}

// Assistant message with thoughts and tool calls
function AssistantMessage({ message }: { message: ConversationMessage }) {
  const { thinking, toolCalls, content, isStreaming } = message;

  // Don't render empty assistant messages that haven't started yet
  if (!thinking && (!toolCalls || toolCalls.length === 0) && !content && !isStreaming) {
    return null;
  }

  return (
    <div className="py-2">
      {/* Thinking indicator when no content yet */}
      {isStreaming && !thinking && (!toolCalls || toolCalls.length === 0) && (
        <ThinkingIndicator />
      )}

      {/* Collapsible thinking section */}
      {thinking && (
        <ThoughtDisplay content={thinking} isStreaming={isStreaming} />
      )}

      {/* Tool calls with status */}
      {toolCalls && toolCalls.length > 0 && (
        <div className="space-y-0.5">
          {toolCalls.map((tc) => (
            <ToolCallDisplay key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Final response text */}
      {content && (
        <div className="mt-2 text-sm text-neutral-700">{content}</div>
      )}
    </div>
  );
}

// Main chat panel component
export function ChatPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    conversationMessages,
    currentBlock,
    isGenerating,
  } = useGenerationStore();

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [conversationMessages, currentBlock?.thinking, currentBlock?.toolCalls]);

  // Get the last message if it's an assistant message being streamed
  const lastMessage = conversationMessages[conversationMessages.length - 1];
  const isLastAssistantStreaming = lastMessage?.type === 'assistant' && lastMessage.isStreaming;

  // Build display messages - use currentBlock to update the streaming assistant message
  const displayMessages = conversationMessages.map((msg, idx) => {
    // If this is the last assistant message and we're streaming, merge with currentBlock
    if (idx === conversationMessages.length - 1 && msg.type === 'assistant' && currentBlock) {
      return {
        ...msg,
        thinking: currentBlock.thinking || msg.thinking,
        toolCalls: currentBlock.toolCalls.length > 0 ? currentBlock.toolCalls : msg.toolCalls,
      };
    }
    return msg;
  });

  // If no messages yet
  if (conversationMessages.length === 0 && !isGenerating) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-400">
        <p className="text-sm">Describe what you want to create...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto space-y-3 scrollbar-thin"
    >
      {displayMessages.map((message) => (
        message.type === 'user' ? (
          <UserMessage key={message.id} content={message.content} />
        ) : (
          <AssistantMessage key={message.id} message={message} />
        )
      ))}

      {/* Show thinking indicator if generating but no assistant message yet */}
      {isGenerating && !isLastAssistantStreaming && (
        <ThinkingIndicator />
      )}
    </div>
  );
}
