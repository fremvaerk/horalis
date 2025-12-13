import { useState } from "react";
import { Clock, BarChart3, Settings, History } from "lucide-react";
import HistoryPage from "./pages/HistoryPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";

type Page = "history" | "reports" | "settings";

const navItems: { id: Page; label: string; icon: typeof Clock }[] = [
  { id: "history", label: "History", icon: History },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Dashboard() {
  const [activePage, setActivePage] = useState<Page>("history");

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-white">
      {/* Sidebar */}
      <aside className="w-56 bg-[#141414] border-r border-white/10 flex flex-col">
        <div className="p-5 border-b border-white/10">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Clock size={20} className="text-blue-500" />
            Time Tracker
          </h1>
        </div>

        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActivePage(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {activePage === "history" && <HistoryPage />}
        {activePage === "reports" && <ReportsPage />}
        {activePage === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
