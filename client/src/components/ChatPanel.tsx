import { useEffect, useRef } from 'react';
import { ChevronDown, Check, X, Loader2, Wrench, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useGenerationStore, type ConversationMessage, type ToolCallState } from '../features/generation/generationStore';
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from './ui/collapsible';
import { cn } from '../lib/utils';

// Helper to get human-readable tool labels
function getToolLabel(toolName: string, hasResult: boolean, hasError: boolean): string {
  const action = hasError ? 'Failed' : hasResult ? 'Edited' : 'Editing';

  switch (toolName) {
    case 'edit_component':
      return `${action} component`;
    case 'create_component':
      return hasResult ? 'Created component' : 'Creating component';
    case 'update_component':
      return hasResult ? 'Updated component' : 'Updating component';
    case 'read_component':
      return hasResult ? 'Read component' : 'Reading component';
    case 'manage_todos':
      return hasResult ? 'Updated tasks' : 'Updating tasks';
    case 'get_layout':
      return hasResult ? 'Checked layout' : 'Checking layout';
    default: {
      const label = toolName.replace(/_/g, ' ');
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }
}

// Thinking indicator while waiting for response
function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-2 text-neutral-500">
      <Loader2 className="w-3 h-3 animate-spin" />
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

// Collapsible thought display (matches minecraftlm ThoughtDisplay)
function ThoughtDisplay({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  if (!content?.trim()) return null;

  return (
    <Collapsible defaultOpen={isStreaming}>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 transition-colors w-full text-left py-1">
        <ChevronDown
          size={12}
          className="transition-transform shrink-0 group-data-[state=open]:rotate-180"
        />
        <span className="flex items-center gap-1.5 min-w-0">
          {isStreaming && <Loader2 size={10} className="animate-spin" />}
          <span className={cn(isStreaming && "animate-pulse")}>
            Thought process
          </span>
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="pl-4 border-l-2 border-neutral-200 py-2">
          <div className="max-w-none max-h-64 overflow-y-auto text-neutral-600 text-xs whitespace-pre-wrap leading-relaxed">
            {content}
            {isStreaming && <span className="inline-block w-1 h-3 bg-neutral-400 animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

// Tool call display with collapsible result (matches minecraftlm ToolCallWithResultDisplay)
function ToolCallDisplay({ toolCall }: { toolCall: ToolCallState }) {
  const { name, status, result } = toolCall;
  const hasResult = status !== 'pending';
  const hasError = status === 'error';

  const label = getToolLabel(name, hasResult, hasError);

  // Parse result content
  let displayContent: string | null = null;
  if (result !== undefined) {
    if (typeof result === 'string') {
      displayContent = result.trim() || null;
    } else if (typeof result === 'object' && result !== null) {
      const resultObj = result as Record<string, unknown>;
      // Try to extract meaningful content
      if (resultObj.message && typeof resultObj.message === 'string') {
        displayContent = resultObj.message;
      } else if (resultObj.error && typeof resultObj.error === 'string') {
        displayContent = resultObj.error;
      } else {
        const json = JSON.stringify(result, null, 2);
        if (json !== '{}') {
          displayContent = json;
        }
      }
    }
  }

  const IconComponent = !hasResult
    ? name === 'edit_component' ? Pencil : Wrench
    : hasError
      ? X
      : Check;

  const iconColor = !hasResult
    ? 'text-neutral-400'
    : hasError
      ? 'text-red-500'
      : 'text-green-500';

  const isExpandable = !!displayContent;
  const shouldDefaultOpen = hasError && isExpandable;

  // Non-expandable version
  if (!isExpandable) {
    return (
      <div className="text-sm py-1 flex items-center gap-1.5 text-neutral-600">
        <IconComponent size={14} className={cn(iconColor, !hasResult && "animate-spin")} />
        <span className="font-medium">{label}</span>
      </div>
    );
  }

  // Expandable version with collapsible
  return (
    <Collapsible className="text-sm" defaultOpen={shouldDefaultOpen}>
      <CollapsibleTrigger className="group w-full text-left py-1 flex items-center gap-1.5 text-neutral-600 hover:text-neutral-800 transition-colors">
        <span className="relative size-3.5">
          <IconComponent
            size={14}
            className={cn(
              iconColor,
              "absolute inset-0 transition-opacity group-hover:opacity-0"
            )}
          />
          <ChevronDown
            size={14}
            className="absolute inset-0 text-neutral-500 opacity-0 transition-all group-hover:opacity-100 group-data-[state=open]:rotate-180"
          />
        </span>
        <span className="font-medium">{label}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <pre
          className={cn(
            "mt-1.5 p-2 rounded-lg text-xs overflow-auto max-h-48",
            hasError
              ? "bg-red-50 text-red-700"
              : "bg-neutral-50 text-neutral-600"
          )}
        >
          {displayContent}
        </pre>
      </CollapsiblePanel>
    </Collapsible>
  );
}

// Assistant message with thoughts and tool calls
function AssistantMessage({ message }: { message: ConversationMessage }) {
  const { thinking, toolCalls, content, isStreaming } = message;

  const hasThought = thinking && thinking.trim();
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasContent = content && content.trim();

  // Show thinking indicator when streaming with no content yet
  const showThinkingIndicator = isStreaming && !hasThought && !hasToolCalls && !hasContent;

  // Don't render completely empty messages
  if (!hasThought && !hasToolCalls && !hasContent && !showThinkingIndicator) {
    return null;
  }

  return (
    <div className="py-2 border-b border-neutral-100">
      <div className="space-y-1.5">
        {hasThought && (
          <ThoughtDisplay content={thinking!} isStreaming={isStreaming} />
        )}

        {hasToolCalls && toolCalls!.map((tc) => (
          <ToolCallDisplay key={tc.id} toolCall={tc} />
        ))}

        {hasContent && (
          <div className="text-sm text-neutral-700 pt-1 prose prose-sm prose-neutral max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}

        {showThinkingIndicator && <ThinkingIndicator />}
      </div>
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
        // During streaming, show text from currentBlock as content
        content: currentBlock.text || msg.content,
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

      {/* Show thinking indicator if generating but no assistant message is streaming yet */}
      {isGenerating && !isLastAssistantStreaming && (
        <ThinkingIndicator />
      )}
    </div>
  );
}
