import { ArrowLeft } from 'lucide-react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { Canvas } from '@/components/canvas/Canvas';
import { ExportButton } from '@/components/ExportButton';
import { CodePreviewPanel } from '@/components/CodePreviewPanel';
import type { Project } from '@/store/projectStore';

interface EditorPageProps {
  project: Project;
  onBack: () => void;
}

export function EditorPage({ project, onBack }: EditorPageProps) {
  return (
    <div className="h-screen bg-neutral-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Projects</span>
          </button>
          <div className="h-4 w-px bg-neutral-200" />
          <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">
            {project.name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton />
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Tabbed (Create/Library) */}
        <Sidebar />

        {/* Canvas area */}
        <div className="flex-1 min-w-0 relative">
          <Canvas />
        </div>

        {/* Right panel - Code preview when editing */}
        <CodePreviewPanel />
      </div>
    </div>
  );
}
