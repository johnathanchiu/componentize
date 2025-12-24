import { useEffect, useRef } from 'react';
import { ChevronDown, Check, X, Loader2, Wrench, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  useConversationMessages,
  useCurrentBlock,
  useIsGenerating,
  type ConversationMessage,
  type MessageBlock,
  type ToolCallState,
} from './generationStore';
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from '../../components/ui/collapsible';
import { cn } from '../../lib/utils';

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
    default:
      return toolName.replace(/_/g, ' ');
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
          <span className={cn(isStreaming && 'animate-pulse')}>Thought process</span>
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="pl-4 border-l-2 border-neutral-200 py-2">
          <div className="max-w-none max-h-64 overflow-y-auto text-neutral-600 text-xs whitespace-pre-wrap leading-relaxed">
            {content}
            {isStreaming && (
              <span className="inline-block w-1 h-3 bg-neutral-400 animate-pulse ml-0.5 align-text-bottom" />
            )}
          </div>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

// Tool call display with collapsible result
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
    ? name === 'edit_component'
      ? Pencil
      : Wrench
    : hasError
      ? X
      : Check;

  const iconColor = !hasResult ? 'text-neutral-400' : hasError ? 'text-red-500' : 'text-green-500';

  const isExpandable = !!displayContent;
  const shouldDefaultOpen = hasError && isExpandable;

  if (!isExpandable) {
    return (
      <div className="text-sm py-1 flex items-center gap-1.5 text-neutral-600">
        <IconComponent size={14} className={cn(iconColor, !hasResult && 'animate-spin')} />
        <span className="font-medium">{label}</span>
      </div>
    );
  }

  return (
    <Collapsible className="text-sm" defaultOpen={shouldDefaultOpen}>
      <CollapsibleTrigger className="group w-full text-left py-1 flex items-center gap-1.5 text-neutral-600 hover:text-neutral-800 transition-colors">
        <span className="relative size-3.5">
          <IconComponent
            size={14}
            className={cn(iconColor, 'absolute inset-0 transition-opacity group-hover:opacity-0')}
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
            'mt-1.5 p-2 rounded-lg text-xs overflow-auto max-h-48',
            hasError ? 'bg-red-50 text-red-700' : 'bg-neutral-50 text-neutral-600'
          )}
        >
          {displayContent}
        </pre>
      </CollapsiblePanel>
    </Collapsible>
  );
}

// Render a single block
function BlockDisplay({ block, isStreaming, isLastBlock }: { block: MessageBlock; isStreaming?: boolean; isLastBlock?: boolean }) {
  const showCursor = isStreaming && isLastBlock;

  switch (block.type) {
    case 'thinking':
      return <ThoughtDisplay content={block.content} isStreaming={showCursor} />;
    case 'text':
      return (
        <div className="text-sm text-neutral-700 pt-1 prose prose-sm prose-neutral max-w-none">
          <ReactMarkdown>{block.content}</ReactMarkdown>
          {showCursor && (
            <span className="inline-block w-1 h-3 bg-neutral-400 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      );
    case 'tool_call':
      return <ToolCallDisplay toolCall={block.toolCall} />;
  }
}

// Assistant message - renders blocks in order
function AssistantMessage({ message }: { message: ConversationMessage }) {
  const { blocks, isStreaming } = message;

  const showThinkingIndicator = isStreaming && blocks.length === 0;

  if (blocks.length === 0 && !showThinkingIndicator) {
    return null;
  }

  return (
    <div className="py-2 border-b border-neutral-100">
      <div className="space-y-1.5">
        {blocks.map((block, idx) => (
          <BlockDisplay
            key={block.type === 'tool_call' ? block.toolCall.id : `${block.type}-${idx}`}
            block={block}
            isStreaming={isStreaming}
            isLastBlock={idx === blocks.length - 1}
          />
        ))}

        {showThinkingIndicator && <ThinkingIndicator />}
      </div>
    </div>
  );
}

// Main chat panel component
export function ChatPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const conversationMessages = useConversationMessages();
  const currentBlock = useCurrentBlock();
  const isGenerating = useIsGenerating();

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [conversationMessages, currentBlock?.blocks]);

  const lastMessage = conversationMessages[conversationMessages.length - 1];
  const isLastAssistantStreaming = lastMessage?.type === 'assistant' && lastMessage.isStreaming;

  // Build display messages - merge currentBlock into streaming message
  const displayMessages = conversationMessages.map((msg, idx) => {
    if (idx === conversationMessages.length - 1 && msg.type === 'assistant' && currentBlock) {
      return {
        ...msg,
        blocks: currentBlock.blocks.length > 0 ? currentBlock.blocks : msg.blocks,
      };
    }
    return msg;
  });

  if (conversationMessages.length === 0 && !isGenerating) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-400">
        <p className="text-sm">Describe what you want to create...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto space-y-3 scrollbar-thin">
      {displayMessages.map((message) =>
        message.type === 'user' ? (
          <UserMessage key={message.id} content={message.content!} />
        ) : (
          <AssistantMessage key={message.id} message={message} />
        )
      )}

      {isGenerating && !isLastAssistantStreaming && <ThinkingIndicator />}
    </div>
  );
}
