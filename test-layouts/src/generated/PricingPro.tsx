import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function PricingPro() {
  return (
    <div className="w-full h-full bg-indigo-600 rounded-2xl p-8 border-2 border-indigo-400 relative flex flex-col">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-400 text-indigo-900 text-sm font-medium px-3 py-1 rounded-full">Popular</div>
      <h3 className="text-lg font-medium text-indigo-200 mb-2">Pro</h3>
      <div className="text-4xl font-bold text-white mb-6">$29<span className="text-lg text-indigo-200">/mo</span></div>
      <ul className="space-y-3 mb-8 flex-1">
        <li className="flex items-center gap-2 text-white"><Check className="w-5 h-5"/>Unlimited projects</li>
        <li className="flex items-center gap-2 text-white"><Check className="w-5 h-5"/>Advanced analytics</li>
        <li className="flex items-center gap-2 text-white"><Check className="w-5 h-5"/>Priority support</li>
        <li className="flex items-center gap-2 text-white"><Check className="w-5 h-5"/>Custom integrations</li>
      </ul>
      <Button className="w-full bg-white text-indigo-600 hover:bg-gray-100">Get Started</Button>
    </div>
  );
}
