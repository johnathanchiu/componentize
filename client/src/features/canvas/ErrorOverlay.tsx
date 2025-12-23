import { AlertCircle, Wrench } from 'lucide-react';

interface ErrorOverlayProps {
  message: string;
  isFixing: boolean;
  onFix: () => void;
}

export function ErrorOverlay({ message, isFixing, onFix }: ErrorOverlayProps) {
  return (
    <div className="absolute inset-0 bg-red-50/95 flex flex-col items-center justify-center p-2 z-20">
      {isFixing ? (
        <>
          <Wrench className="w-6 h-6 text-amber-500 mb-1 animate-spin" />
          <div className="text-xs font-medium text-amber-800 mb-1">Auto-fixing...</div>
          <div className="text-[10px] text-amber-600 text-center max-w-full">
            Regenerating component
          </div>
        </>
      ) : (
        <>
          <AlertCircle className="w-6 h-6 text-red-500 mb-1" />
          <div className="text-xs font-medium text-red-800 mb-1">Error</div>
          <div className="text-[10px] text-red-600 text-center mb-2 max-w-full overflow-hidden line-clamp-2">
            {message}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFix();
            }}
            className="px-2 py-1 bg-red-500 text-white rounded text-[10px] font-medium hover:bg-red-600 flex items-center gap-1"
          >
            <Wrench className="w-3 h-3" />
            Fix
          </button>
        </>
      )}
    </div>
  );
}
