import { useEffect, useState, useRef } from 'react';
import { Folder, Trash2, Loader2, ArrowUp } from 'lucide-react';
import { useProjectStore, type Project } from '@/store/projectStore';
import { listProjects, createProject, deleteProject } from '@/lib/api';

// Hardcoded suggestions for UI components
const SUGGESTIONS = [
  { emoji: '📊', label: 'Stats Dashboard', prompt: 'Build a stats dashboard card showing key metrics with icons and trend indicators' },
  { emoji: '🚀', label: 'SaaS Landing Page', prompt: 'Build a SaaS landing page with hero section, feature grid, pricing cards, and call-to-action' },
  { emoji: '📝', label: 'Contact Form', prompt: 'Build a contact form with name, email, message fields, and validation' },
  { emoji: '🎯', label: 'Hero Section', prompt: 'Build a hero section with headline, subheadline, CTA buttons, and an image' },
];

interface ProjectsPageProps {
  onOpenProject: (project: Project) => void;
}

export function ProjectsPage({ onOpenProject }: ProjectsPageProps) {
  const { projects, setProjects, addProject, removeProject, isLoadingProjects, setIsLoadingProjects } = useProjectStore();
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasProjects = projects.length > 0;

  // Fetch projects on mount
  useEffect(() => {
    async function fetchProjects() {
      setIsLoadingProjects(true);
      try {
        const response = await listProjects();
        setProjects(response.projects);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    }
    fetchProjects();
  }, [setProjects, setIsLoadingProjects]);

  // Handle creating project from prompt
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isCreating) return;

    setIsCreating(true);
    try {
      // Create project with a name derived from the prompt
      const projectName = prompt.slice(0, 40).trim() + (prompt.length > 40 ? '...' : '');
      const response = await createProject(projectName);
      addProject(response.project);

      // Store the prompt to be used after navigation
      sessionStorage.setItem('pendingPrompt', prompt);

      // Navigate to the new project
      onOpenProject(response.project);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
      setPrompt('');
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestionPrompt: string) => {
    setPrompt(suggestionPrompt);
    textareaRef.current?.focus();
  };

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle delete project
  const handleDelete = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      removeProject(projectToDelete.id);
      setProjectToDelete(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format relative time
  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays >= 7) return 'over a week ago';
    if (diffDays >= 1) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours >= 1) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins >= 1) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    return 'just now';
  };

  return (
    <div className={`min-h-screen bg-neutral-50 ${hasProjects ? 'grid grid-rows-[auto_1fr]' : ''}`}>
      {/* Hero Section */}
      <div className={`flex flex-col items-center justify-center px-8 ${hasProjects ? 'py-20 pb-12' : 'min-h-screen py-12'}`}>
        <div className="w-full max-w-3xl flex flex-col items-center">
          <h1 className="text-5xl font-semibold text-neutral-900 mb-4 tracking-tight">
            Componentize
          </h1>
          <p className="text-xl text-neutral-500 mb-10 text-center">
            What would you like to build?
          </p>

          {/* Prompt Input */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl">
            <div className="relative bg-white rounded-2xl shadow-lg border border-neutral-200 p-4 focus-within:ring-2 focus-within:ring-neutral-900 focus-within:border-transparent transition-all">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the component you want to build..."
                rows={2}
                className="w-full resize-none bg-transparent outline-none text-neutral-900 placeholder:text-neutral-400 text-base leading-relaxed pr-12"
              />
              <button
                type="submit"
                disabled={!prompt.trim() || isCreating}
                className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>

          {/* Suggestion Buttons */}
          <div className="flex flex-wrap gap-2 justify-center mt-6">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.label}
                onClick={() => handleSuggestionClick(suggestion.prompt)}
                disabled={isCreating}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-full text-sm text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span>{suggestion.emoji}</span>
                <span>{suggestion.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Past Projects Section */}
      {!isLoadingProjects && hasProjects && (
        <div className="px-8 pb-16 flex justify-center">
          <div className="w-full max-w-5xl">
            <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-6">
              Past Projects
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((project) => (
                  <div
                    key={project.id}
                    onClick={() => onOpenProject(project)}
                    className="group relative bg-white border border-neutral-200 rounded-xl p-5 hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer"
                    data-project-id={project.id}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                          <Folder className="w-5 h-5 text-neutral-500" />
                        </div>
                        <div>
                          <h3 className="font-medium text-neutral-900 line-clamp-1">{project.name}</h3>
                          <p className="text-sm text-neutral-500">
                            {formatRelativeTime(project.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(project);
                        }}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoadingProjects && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Delete Project</h2>
            <p className="text-neutral-600 mb-6">
              Are you sure you want to delete "{projectToDelete.name}"? This will permanently delete all components in this project.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
