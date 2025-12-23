import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { usePageStatus, usePageGenerationActions } from '../../store/generationStore';

const DEMO_PRESETS = [
  {
    label: "SaaS Landing",
    prompt: "A modern SaaS landing page with a gradient hero section featuring a headline, subheadline, and email signup. Below that, three feature cards with icons. End with a call-to-action button.",
  },
  {
    label: "Dashboard",
    prompt: "A clean dashboard with a sidebar navigation, header with user avatar, three stat cards showing numbers, and a data table with pagination.",
  },
  {
    label: "Pricing Page",
    prompt: "A pricing page with three pricing tiers (Basic, Pro, Enterprise) as cards. Include feature lists, prices, and call-to-action buttons.",
  },
];

const PLACEHOLDER_TEXTS = [
  "A landing page with a hero section, feature cards, and a CTA button...",
  "A dashboard with sidebar navigation and stat cards...",
  "A pricing page with three tiers and comparison features...",
  "A contact form with validation and a success message...",
];

interface GeneratePageModalProps {
  onGenerate: (prompt: string) => void;
}

export function GeneratePageModal({ onGenerate }: GeneratePageModalProps) {
  // Use typed selector hooks for optimal re-rendering
  const status = usePageStatus();
  const { pageCloseModal: closeModal } = usePageGenerationActions();
  const [prompt, setPrompt] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Rotate placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_TEXTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  if (status !== 'modal') return null;

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onGenerate(prompt.trim());
  };

  const handlePresetClick = (presetPrompt: string) => {
    setPrompt(presetPrompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={closeModal}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 animate-in zoom-in-95 fade-in duration-300">
        {/* Close button */}
        <button
          onClick={closeModal}
          className="absolute -top-12 right-0 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/20 rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">AI-Powered</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              What do you want to build?
            </h2>
            <p className="text-neutral-400">
              Describe your page and watch it come to life
            </p>
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-40 bg-neutral-900/50 border border-neutral-700 rounded-xl p-6 text-lg text-white placeholder-neutral-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none outline-none transition-all"
              placeholder={PLACEHOLDER_TEXTS[placeholderIndex]}
            />
            <div className="absolute bottom-3 right-3 text-xs text-neutral-500">
              Press Enter to generate
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="mt-6">
            <div className="text-sm text-neutral-500 mb-3">Or try a demo:</div>
            <div className="flex flex-wrap gap-2">
              {DEMO_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset.prompt)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-lg transition-colors border border-neutral-700 hover:border-neutral-600"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="w-full mt-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-neutral-700 disabled:to-neutral-700 disabled:cursor-not-allowed rounded-xl text-white text-lg font-semibold transition-all relative overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Generate Page
            </span>
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </button>
        </div>
      </div>
    </div>
  );
}
