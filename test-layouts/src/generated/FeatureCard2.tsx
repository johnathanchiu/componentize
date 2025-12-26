import { Shield } from "lucide-react";

export default function FeatureCard2() {
  return (
    <div className="w-full h-full bg-slate-800 rounded-2xl p-8 border border-slate-700">
      <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
        <Shield className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Secure by Default</h3>
      <p className="text-gray-400">Enterprise-grade security built into every layer.</p>
    </div>
  );
}
