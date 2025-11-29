import { Brain, Wrench, CheckCircle, XCircle } from 'lucide-react';
import type { StreamEvent } from '../types';

interface TimelineEventProps {
  event: StreamEvent;
}

export function TimelineEvent({ event }: TimelineEventProps) {
  const getEventStyle = () => {
    switch (event.type) {
      case 'thinking':
        return {
          icon: <Brain className="w-3.5 h-3.5 text-ai-thinking" />,
          borderClass: 'border-l-ai-thinking',
          bgClass: 'bg-ai-thinking/5',
        };
      case 'tool_start':
        return {
          icon: <Wrench className="w-3.5 h-3.5 text-ai-action" />,
          borderClass: 'border-l-ai-action',
          bgClass: 'bg-ai-action/5',
        };
      case 'tool_result':
        const isSuccess = event.data?.status === 'success';
        return {
          icon: isSuccess
            ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            : <XCircle className="w-3.5 h-3.5 text-red-500" />,
          borderClass: isSuccess ? 'border-l-green-500' : 'border-l-red-500',
          bgClass: isSuccess ? 'bg-green-500/5' : 'bg-red-500/5',
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
          borderClass: 'border-l-green-500',
          bgClass: 'bg-green-500/5',
        };
      case 'error':
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-red-500" />,
          borderClass: 'border-l-red-500',
          bgClass: 'bg-red-500/5',
        };
      default:
        return {
          icon: null,
          borderClass: 'border-l-neutral-300',
          bgClass: 'bg-neutral-50',
        };
    }
  };

  const { icon, borderClass, bgClass } = getEventStyle();

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 border-l-2 ${borderClass} ${bgClass} animate-slide-up`}
    >
      {icon && <div className="mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-700 leading-relaxed break-words">
          {event.message}
        </p>
        {event.data?.toolName && event.type === 'tool_start' && (
          <p className="text-xs text-neutral-500 mt-1 font-mono">
            {event.data.toolName}
            {event.data.toolInput?.componentName != null && (
              <span className="text-ai-action"> → {String(event.data.toolInput.componentName)}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
