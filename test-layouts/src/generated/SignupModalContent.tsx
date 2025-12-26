import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface Props {
  onClose?: () => void;
}

export default function SignupModalContent({ onClose }: Props) {
  return (
    <div className="w-full h-full bg-slate-800 rounded-2xl p-8 border border-slate-700 relative">
      <button
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>
      <h2 className="text-2xl font-bold text-white mb-2">Start your free trial</h2>
      <p className="text-gray-400 mb-6">No credit card required</p>
      <div className="space-y-4">
        <Input placeholder="Full name" className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400" />
        <Input placeholder="Email" type="email" className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400" />
        <Input placeholder="Password" type="password" className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400" />
        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">Create Account</Button>
      </div>
      <p className="text-center text-gray-500 text-sm mt-4">
        Already have an account? <a href="#" className="text-indigo-400 hover:underline">Sign in</a>
      </p>
    </div>
  );
}
