import { Star, ThumbsUp } from "lucide-react";

const reviews = [
  { name: "Alex M.", rating: 5, text: "Best running shoes I've ever owned. The cushioning is incredible!", helpful: 24 },
  { name: "Sarah K.", rating: 4, text: "Great shoes, super comfortable. Runs a bit narrow though.", helpful: 12 },
];

export default function ReviewsSection() {
  return (
    <div className="w-full h-full bg-slate-800 rounded-xl p-6 border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Customer Reviews</h3>
        <button className="text-indigo-400 text-sm hover:underline">See all 128</button>
      </div>
      <div className="space-y-4">
        {reviews.map((review, index) => (
          <div key={index} className="pb-4 border-b border-slate-700 last:border-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {review.name.charAt(0)}
                </div>
                <span className="text-white text-sm font-medium">{review.name}</span>
              </div>
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${i <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-2">{review.text}</p>
            <button className="flex items-center gap-1 text-gray-500 text-xs hover:text-gray-400">
              <ThumbsUp className="w-3 h-3" />
              Helpful ({review.helpful})
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
