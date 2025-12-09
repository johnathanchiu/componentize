import { Sparkles } from 'lucide-react';
import { usePageGenerationStore } from '../../store/pageGenerationStore';

export function GeneratePageButton() {
  const { openModal, status } = usePageGenerationStore();

  const isGenerating = status === 'planning' || status === 'generating';

  return (
    <button
      onClick={openModal}
      disabled={isGenerating}
      className="relative overflow-hidden group px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-neutral-500 disabled:to-neutral-500 text-white rounded-lg font-medium transition-all"
    >
      <span className="relative z-10 flex items-center gap-2">
        <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
        {isGenerating ? 'Generating...' : 'Generate Page'}
      </span>
      {/* Animated shimmer effect */}
      {!isGenerating && (
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}
    </button>
  );
}
