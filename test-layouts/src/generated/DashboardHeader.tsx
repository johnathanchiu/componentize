import { Bell, Search, User } from "lucide-react";

export default function DashboardHeader() {
  return (
    <div className="w-full h-full flex items-center justify-between px-6 bg-slate-800 border-b border-slate-700">
      <div className="flex items-center gap-8">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-slate-700 text-gray-300 text-sm rounded-lg pl-10 pr-4 py-2 w-64 border border-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
}
