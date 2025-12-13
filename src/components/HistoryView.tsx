import { useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { getTimeEntries, TimeEntry } from "../lib/db";

interface EntryWithProject extends TimeEntry {
  project_name: string;
  project_color: string;
}

interface DayGroup {
  date: string;
  displayDate: string;
  entries: EntryWithProject[];
  totalDuration: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  }
  return `0h ${m.toString().padStart(2, "0")}min`;
}

function formatEntryDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr + "Z");
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDateKey(dateStr: string): string {
  // Extract just the date part (YYYY-MM-DD) from the datetime string
  return dateStr.split(" ")[0];
}

function formatDisplayDate(dateKey: string): string {
  // dateKey is in format YYYY-MM-DD
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const entryDate = new Date(year, month - 1, day);
  entryDate.setHours(0, 0, 0, 0);

  if (entryDate.getTime() === today.getTime()) {
    return "Today";
  } else if (entryDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  } else {
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const dateFormatted = date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    return `${weekday}  ${dateFormatted}`;
  }
}

function groupEntriesByDay(entries: EntryWithProject[]): DayGroup[] {
  const groups: Map<string, EntryWithProject[]> = new Map();

  for (const entry of entries) {
    const dateKey = getDateKey(entry.start_time);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(entry);
  }

  const result: DayGroup[] = [];
  for (const [dateKey, dayEntries] of groups) {
    const totalDuration = dayEntries.reduce(
      (sum, e) => sum + (e.duration || 0),
      0
    );
    result.push({
      date: dateKey,
      displayDate: formatDisplayDate(dateKey),
      entries: dayEntries,
      totalDuration,
    });
  }

  return result.sort((a, b) => b.date.localeCompare(a.date));
}

export default function HistoryView() {
  const [entries, setEntries] = useState<EntryWithProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    try {
      const data = await getTimeEntries(200);
      setEntries(data);
    } catch (error) {
      console.error("Failed to load entries:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const dayGroups = groupEntriesByDay(entries);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white" style={{ padding: "24px 32px" }}>
      <header style={{ marginBottom: "32px", paddingTop: "8px" }}>
        <h1 className="text-2xl font-semibold">History</h1>
      </header>

      <div className="space-y-6">
        {dayGroups.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No time entries yet. Start tracking to see your history.
          </div>
        ) : (
          dayGroups.map((group) => (
            <div key={group.date} className="space-y-2">
              {/* Day header */}
              <div className="flex justify-between items-center py-2 px-1">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">📅</span>
                  <span className="text-sm font-medium text-white">
                    {group.displayDate}
                  </span>
                </div>
                <span className="text-sm text-gray-400">
                  {formatDuration(group.totalDuration)}
                </span>
              </div>

              {/* Entries for this day */}
              <div className="bg-[#252525] rounded-xl overflow-hidden">
                {group.entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 px-5 py-4 hover:bg-white/5 group ${
                      index !== group.entries.length - 1 ? "border-b border-white/5" : ""
                    }`}
                  >
                    {/* Project color and name */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: entry.project_color }}
                      />
                      <span className="font-medium truncate">
                        {entry.project_name}
                      </span>
                    </div>

                    {/* Time range */}
                    <div className="text-sm text-gray-400 shrink-0">
                      {formatTime(entry.start_time)} - {entry.end_time ? formatTime(entry.end_time) : "..."}
                    </div>

                    {/* Duration */}
                    <div className="text-sm font-medium text-gray-300 w-16 text-right shrink-0">
                      {formatEntryDuration(entry.duration || 0)}
                    </div>

                    {/* Menu button */}
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === entry.id ? null : entry.id)}
                        className="p-2 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical size={16} className="text-gray-400" />
                      </button>

                      {menuOpen === entry.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-[#333] rounded-lg shadow-xl border border-white/10 py-1 z-50">
                          <button
                            onClick={() => {
                              // TODO: Implement edit
                              setMenuOpen(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-white/10"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              // TODO: Implement delete
                              setMenuOpen(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-white/10 text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
