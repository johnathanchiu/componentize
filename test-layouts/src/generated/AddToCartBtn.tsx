import { ShoppingCart } from "lucide-react";

export default function AddToCartBtn() {
  return (
    <div className="w-full h-full flex gap-3">
      <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
        <ShoppingCart className="w-5 h-5" />
        Add to Cart
      </button>
      <button className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl border border-slate-600 transition-colors">
        Buy Now
      </button>
    </div>
  );
}
