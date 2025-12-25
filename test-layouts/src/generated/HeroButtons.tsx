import { Button } from "@/components/ui/button"
import { ArrowRight, Play } from "lucide-react"

export default function HeroButtons() {
  return (
    <div className="w-full h-full flex items-center justify-center gap-4">
      <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8">
        Get Started
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
      <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
        <Play className="mr-2 h-5 w-5" />
        Watch Demo
      </Button>
    </div>
  );
}
