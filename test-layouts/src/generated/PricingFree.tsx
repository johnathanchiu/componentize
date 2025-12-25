import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function PricingFree() {
  return (
    <div className="w-full h-full bg-slate-800 rounded-2xl p-8 border border-slate-700 flex flex-col">
      <h3 className="text-lg font-medium text-gray-400 mb-2">Starter</h3>
      <div className="text-4xl font-bold text-white mb-6">$0<span className="text-lg text-gray-400">/mo</span></div>
      <ul className="space-y-3 mb-8 flex-1">
        <li className="flex items-center gap-2 text-gray-300"><Check className="w-5 h-5 text-indigo-400"/>5 projects</li>
        <li className="flex items-center gap-2 text-gray-300"><Check className="w-5 h-5 text-indigo-400"/>Basic analytics</li>
        <li className="flex items-center gap-2 text-gray-300"><Check className="w-5 h-5 text-indigo-400"/>Community support</li>
      </ul>
      <Button variant="outline" className="w-full border-gray-600 text-white hover:bg-gray-800">Get Started</Button>
    </div>
  );
}
