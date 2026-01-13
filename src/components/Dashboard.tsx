import { useState } from "react";
import { Clock, BarChart3, Settings, History, Timer } from "lucide-react";
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
    <div className="dashboard-root flex h-screen text-white" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside
        className="w-60 flex flex-col border-r"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        {/* Logo */}
        <div
          className="px-5 py-6 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'var(--accent-primary-muted)',
                boxShadow: '0 0 20px var(--accent-primary-muted)'
              }}
            >
              <Timer size={18} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Horalis</h1>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Time Tracker
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <div className="mb-3 px-3">
            <span
              className="text-[10px] font-medium uppercase tracking-widest"
              style={{ color: 'var(--text-faint)' }}
            >
              Menu
            </span>
          </div>
          <ul className="space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <li key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <button
                    onClick={() => setActivePage(item.id)}
                    className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{
                      background: isActive ? 'var(--bg-card)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                        style={{
                          background: 'var(--accent-primary)',
                          boxShadow: '0 0 10px var(--accent-primary-glow)'
                        }}
                      />
                    )}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                      style={{
                        background: isActive ? 'var(--accent-primary-muted)' : 'transparent',
                      }}
                    >
                      <Icon
                        size={16}
                        style={{
                          color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}
                        className="transition-colors duration-200 group-hover:text-white"
                      />
                    </div>
                    <span className="transition-colors duration-200 group-hover:text-white">
                      {item.label}
                    </span>
                    {/* Hover arrow indicator */}
                    <svg
                      className="ml-auto opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-50 group-hover:translate-x-0"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div
          className="px-4 py-4 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="px-3 py-2 rounded-lg text-xs"
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-muted)'
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)' }}>v0.1.0</span>
            <span className="mx-2">·</span>
            <span>Beta</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className="flex-1 overflow-auto"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="animate-fade-in" key={activePage}>
          {activePage === "history" && <HistoryPage />}
          {activePage === "reports" && <ReportsPage />}
          {activePage === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
