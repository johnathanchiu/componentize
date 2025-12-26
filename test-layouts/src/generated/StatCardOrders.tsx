import { ShoppingCart, TrendingUp } from "lucide-react";

export default function StatCardOrders() {
  return (
    <div className="w-full h-full bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex items-center text-green-400 text-sm">
          <TrendingUp className="w-4 h-4 mr-1" />
          +5.7%
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-1">Total Orders</p>
      <p className="text-2xl font-bold text-white">1,423</p>
    </div>
  );
}
