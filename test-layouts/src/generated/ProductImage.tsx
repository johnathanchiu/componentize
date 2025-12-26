export default function ProductImage() {
  return (
    <div className="w-full h-full bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
      <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 bg-indigo-600/20 rounded-xl flex items-center justify-center">
            <span className="text-4xl">👟</span>
          </div>
          <p className="text-gray-400 text-sm">Product Image</p>
        </div>
      </div>
    </div>
  );
}
