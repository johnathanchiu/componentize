import { useEffect, useRef, useState } from 'react';
import { Sparkles, Check, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { usePageGenerationStore } from '../../store/pageGenerationStore';

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      <span className="animate-pulse">|</span>
    </span>
  );
}

interface ComponentSlotProps {
  name: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  position: { x: number; y: number };
  size: { width: number; height: number };
}

function ComponentSlot({ name, status, position, size }: ComponentSlotProps) {
  return (
    <div
      className={`absolute rounded-lg border-2 border-dashed transition-all duration-500 ${
        status === 'pending' ? 'border-neutral-600/50 bg-neutral-800/20' :
        status === 'generating' ? 'border-purple-500 bg-purple-500/10 animate-pulse shadow-lg shadow-purple-500/20' :
        status === 'complete' ? 'border-green-500/50 bg-green-500/10 opacity-0' :
        'border-red-500/50 bg-red-500/10'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
          status === 'pending' ? 'bg-neutral-800/80 text-neutral-400' :
          status === 'generating' ? 'bg-purple-600/80 text-white' :
          status === 'complete' ? 'bg-green-600/80 text-white' :
          'bg-red-600/80 text-white'
        }`}>
          {status === 'generating' && <Sparkles className="w-3 h-3 animate-spin" />}
          {status === 'complete' && <Check className="w-3 h-3" />}
          {status === 'failed' && <AlertCircle className="w-3 h-3" />}
          <span className="text-xs font-medium">{name}</span>
        </div>
      </div>
    </div>
  );
}

export function PageGenerationOverlay() {
  const {
    status,
    plan,
    currentComponentIndex,
    totalComponents,
    completedComponents,
    failedComponents,
    currentThinking,
    reset,
  } = usePageGenerationStore();

  const hasTriggeredConfetti = useRef(false);

  // Trigger confetti on completion
  useEffect(() => {
    if (status === 'complete' && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8B5CF6', '#3B82F6', '#10B981'],
      });

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        reset();
      }, 3000);
    }
  }, [status, reset]);

  // Reset confetti flag when status changes to idle
  useEffect(() => {
    if (status === 'idle') {
      hasTriggeredConfetti.current = false;
    }
  }, [status]);

  if (status === 'idle' || status === 'modal') return null;

  const progressPercentage = totalComponents > 0
    ? ((completedComponents.length + failedComponents.length) / totalComponents) * 100
    : 0;

  return (
    <div className="absolute inset-0 z-40 pointer-events-none">
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />

      {/* Component slots */}
      {plan?.map((component, index) => {
        const isComplete = completedComponents.includes(component.name);
        const isFailed = failedComponents.some((f) => f.name === component.name);
        const isGenerating = currentComponentIndex === index + 1 && !isComplete && !isFailed;

        // Calculate position based on layout hint (simplified)
        const position = component.position || { x: 200, y: 50 + index * 250 };
        const size = component.size || { width: 800, height: 200 };

        return (
          <ComponentSlot
            key={component.name}
            name={component.name}
            status={
              isComplete ? 'complete' :
              isFailed ? 'failed' :
              isGenerating ? 'generating' :
              'pending'
            }
            position={position}
            size={size}
          />
        );
      })}

      {/* Bottom progress panel */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[500px] pointer-events-auto">
        <div className="bg-neutral-900/95 backdrop-blur-lg rounded-2xl border border-neutral-700 p-6 shadow-2xl">
          {/* Status header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {status === 'complete' ? (
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              ) : status === 'error' ? (
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
              <div>
                <div className="text-white font-medium">
                  {status === 'planning' && 'Analyzing your description...'}
                  {status === 'generating' && `Creating ${plan?.[currentComponentIndex - 1]?.name || 'components'}...`}
                  {status === 'complete' && 'Page generated!'}
                  {status === 'error' && 'Generation failed'}
                </div>
                <div className="text-sm text-neutral-400">
                  {status === 'generating' && `${currentComponentIndex} of ${totalComponents} components`}
                  {status === 'complete' && `${completedComponents.length} components created`}
                </div>
              </div>
            </div>

            {status === 'complete' && (
              <button
                onClick={reset}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-lg transition-colors"
              >
                Done
              </button>
            )}
          </div>

          {/* Progress bar */}
          {status !== 'planning' && (
            <div className="h-2 bg-neutral-700 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}

          {/* Component chips */}
          {plan && (
            <div className="flex flex-wrap gap-2 mb-4">
              {plan.map((component) => {
                const isComplete = completedComponents.includes(component.name);
                const isFailed = failedComponents.some((f) => f.name === component.name);
                const isGenerating = currentComponentIndex === plan.indexOf(component) + 1 && !isComplete && !isFailed;

                return (
                  <div
                    key={component.name}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      isComplete ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                      isFailed ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      isGenerating ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse' :
                      'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}
                  >
                    {isComplete && <Check className="w-3 h-3 inline mr-1" />}
                    {component.name}
                  </div>
                );
              })}
            </div>
          )}

          {/* AI thinking text */}
          {currentThinking && status !== 'complete' && (
            <div className="text-xs text-neutral-500 truncate">
              <TypewriterText text={currentThinking} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
