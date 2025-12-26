export default function ProductPrice() {
  return (
    <div className="w-full h-full flex items-center gap-4">
      <span className="text-3xl font-bold text-white">$189.00</span>
      <span className="text-lg text-gray-500 line-through">$249.00</span>
      <span className="px-2 py-1 bg-green-600/20 text-green-400 text-sm font-medium rounded">
        24% OFF
      </span>
    </div>
  );
}
