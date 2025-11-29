import type { StreamStatus } from '../types';

interface StatusOrbProps {
  status: StreamStatus;
  size?: 'sm' | 'md';
}

export function StatusOrb({ status, size = 'md' }: StatusOrbProps) {
  const sizeClasses = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  const statusClasses: Record<StreamStatus, string> = {
    idle: 'bg-neutral-400',
    thinking: 'bg-ai-thinking animate-pulse-fast',
    acting: 'bg-ai-action animate-pulse',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <span
      className={`inline-block rounded-full ${sizeClasses} ${statusClasses[status]}`}
      aria-label={`Status: ${status}`}
    />
  );
}
