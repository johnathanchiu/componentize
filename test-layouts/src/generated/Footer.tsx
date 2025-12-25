export default function Footer() {
  return (
    <div className="w-full h-full flex items-center justify-between px-8 border-t border-slate-700">
      <span className="text-gray-500">© 2024 Acme Inc.</span>
      <div className="flex gap-6">
        <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors">Privacy</a>
        <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors">Terms</a>
        <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors">Contact</a>
      </div>
    </div>
  );
}
