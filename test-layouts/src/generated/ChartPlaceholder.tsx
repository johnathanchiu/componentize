export default function ChartPlaceholder() {
  return (
    <div className="w-full h-full bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Revenue Overview</h3>
        <select className="bg-slate-700 text-gray-300 text-sm rounded-lg px-3 py-1 border border-slate-600">
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>Last 90 days</option>
        </select>
      </div>
      <div className="flex items-end justify-around h-40 gap-2">
        {[40, 65, 45, 80, 55, 90, 70].map((height, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-1">
            <div
              className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md"
              style={{ height: `${height}%` }}
            />
            <span className="text-xs text-gray-500">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
