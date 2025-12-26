import { User, ShoppingBag, CreditCard, UserPlus } from "lucide-react";

const activities = [
  { icon: UserPlus, color: "blue", title: "New user registered", time: "2 min ago", user: "Sarah Chen" },
  { icon: ShoppingBag, color: "green", title: "New order placed", time: "5 min ago", user: "Mike Johnson" },
  { icon: CreditCard, color: "purple", title: "Payment received", time: "12 min ago", user: "Alex Smith" },
  { icon: User, color: "orange", title: "Profile updated", time: "25 min ago", user: "Emma Wilson" },
];

const colorMap: Record<string, string> = {
  blue: "bg-blue-600/20 text-blue-400",
  green: "bg-green-600/20 text-green-400",
  purple: "bg-purple-600/20 text-purple-400",
  orange: "bg-orange-600/20 text-orange-400",
};

export default function ActivityFeed() {
  return (
    <div className="w-full h-full bg-slate-800 rounded-xl p-6 border border-slate-700 overflow-hidden">
      <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const Icon = activity.icon;
          return (
            <div key={index} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[activity.color]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{activity.title}</p>
                <p className="text-xs text-gray-500">{activity.user}</p>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{activity.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
