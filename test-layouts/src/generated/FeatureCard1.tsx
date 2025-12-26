import { Zap } from "lucide-react";

export default function FeatureCard1() {
  return (
    <div className="w-full h-full bg-slate-800 rounded-2xl p-8 border border-slate-700">
      <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
        <Zap className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Lightning Fast</h3>
      <p className="text-gray-400">Deploy in seconds with our optimized infrastructure.</p>
    </div>
  );
}
