import { Star, Heart, Share2 } from "lucide-react";

export default function ProductInfo() {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-indigo-400 text-sm font-medium">Premium Collection</span>
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 hover:text-red-400 transition-colors">
            <Heart className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">
        Ultra Boost Runner Pro
      </h1>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${i <= 4 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
            />
          ))}
        </div>
        <span className="text-gray-400 text-sm">(128 reviews)</span>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed">
        Experience the future of running with our most advanced cushioning technology.
        Engineered for maximum comfort and explosive energy return.
      </p>
    </div>
  );
}
