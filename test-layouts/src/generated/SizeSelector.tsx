import { useState } from "react";

const sizes = ["7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11"];

export default function SizeSelector() {
  const [selectedSize, setSelectedSize] = useState("9");

  return (
    <div className="w-full h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white font-medium">Select Size</span>
        <button className="text-indigo-400 text-sm hover:underline">Size Guide</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => (
          <button
            key={size}
            onClick={() => setSelectedSize(size)}
            className={`w-12 h-10 rounded-lg font-medium transition-colors ${
              selectedSize === size
                ? "bg-indigo-600 text-white"
                : "bg-slate-700 text-gray-300 hover:bg-slate-600 border border-slate-600"
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
