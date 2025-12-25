import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function HeroCTA() {
  return (
    <div className="w-full h-full flex items-center justify-center gap-4">
      <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
        Start Free Trial <ArrowRight className="w-4 h-4" />
      </Button>
      <Button size="lg" variant="outline" className="text-white border-gray-600 hover:bg-gray-800">
        Watch Demo
      </Button>
    </div>
  );
}
