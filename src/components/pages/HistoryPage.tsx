import { useEffect, useState } from "react";
import { MoreVertical, Trash2, Pencil, AlertTriangle, X } from "lucide-react";
import { getTimeEntries, getProjects, deleteTimeEntry, updateTimeEntry, TimeEntry, Project } from "../../lib/db";

interface EntryWithProject extends TimeEntry {
  project_name: string;
  project_color: string;
}

interface ProjectSummary {
  projectId: number;
  projectName: string;
  projectColor: string;
  totalSeconds: number;
  percentage: number;
}

interface DayGroup {
  date: string;
  displayDate: string;
  entries: EntryWithProject[];
  totalDuration: number;
  projectBreakdown: ProjectSummary[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  }
  return `${m}min`;
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

function parseDbDate(dateStr: string): Date {
  // Handle both SQLite format (2025-12-11 09:00:44) and ISO format (2025-12-11T09:00:44Z)
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  return new Date(dateStr + "Z");
}

function formatTime(dateStr: string): string {
  const date = parseDbDate(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDateKey(dateStr: string): string {
  // Handle both formats
  if (dateStr.includes("T")) {
    return dateStr.split("T")[0];
  }
  return dateStr.split(" ")[0];
}

function formatDisplayDate(dateKey: string): string {
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
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${weekday}, ${day}.${month}.${year}`;
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
    const totalDuration = dayEntries.reduce((sum, e) => sum + (e.duration || 0), 0);

    // Calculate project breakdown
    const projectTotals = new Map<number, { name: string; color: string; seconds: number }>();
    for (const entry of dayEntries) {
      const existing = projectTotals.get(entry.project_id);
      if (existing) {
        existing.seconds += entry.duration || 0;
      } else {
        projectTotals.set(entry.project_id, {
          name: entry.project_name,
          color: entry.project_color,
          seconds: entry.duration || 0,
        });
      }
    }

    const projectBreakdown: ProjectSummary[] = Array.from(projectTotals.entries())
      .map(([projectId, data]) => ({
        projectId,
        projectName: data.name,
        projectColor: data.color,
        totalSeconds: data.seconds,
        percentage: totalDuration > 0 ? (data.seconds / totalDuration) * 100 : 0,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    result.push({
      date: dateKey,
      displayDate: formatDisplayDate(dateKey),
      entries: dayEntries,
      totalDuration,
      projectBreakdown,
    });
  }

  return result.sort((a, b) => b.date.localeCompare(a.date));
}

function toLocalDateTimeInput(dbDateStr: string): string {
  const date = parseDbDate(dbDateStr);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDateTimeInput(localDateTimeStr: string): string {
  const date = new Date(localDateTimeStr);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function DaySummaryBar({ breakdown }: { breakdown: ProjectSummary[] }) {
  const [hoveredProject, setHoveredProject] = useState<ProjectSummary | null>(null);

  if (breakdown.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex h-2 rounded-full overflow-hidden bg-[#1a1a1a]">
        {breakdown.map((project, index) => (
          <div
            key={project.projectId}
            className="relative h-full transition-opacity hover:opacity-80"
            style={{
              backgroundColor: project.projectColor,
              width: `${Math.max(project.percentage, 2)}%`,
              marginLeft: index > 0 ? "1px" : 0,
            }}
            onMouseEnter={() => setHoveredProject(project)}
            onMouseLeave={() => setHoveredProject(null)}
          />
        ))}
      </div>

      {/* Tooltip */}
      {hoveredProject && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded text-xs whitespace-nowrap z-50 shadow-lg">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: hoveredProject.projectColor }}
            />
            <span className="font-medium">{hoveredProject.projectName}</span>
            <span className="text-gray-400">{formatDuration(hoveredProject.totalSeconds)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<EntryWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<EntryWithProject | null>(null);
  const [editEntry, setEditEntry] = useState<EntryWithProject | null>(null);
  const [editProjectId, setEditProjectId] = useState<number>(0);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [entriesData, projectsData] = await Promise.all([
        getTimeEntries(200),
        getProjects(),
      ]);
      setEntries(entriesData);
      setProjects(projectsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      await deleteTimeEntry(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadData();
    } catch (error) {
      console.error("Failed to delete entry:", error);
    }
  }

  function openEditModal(entry: EntryWithProject) {
    setEditEntry(entry);
    setEditProjectId(entry.project_id);
    setEditStartTime(toLocalDateTimeInput(entry.start_time));
    setEditEndTime(entry.end_time ? toLocalDateTimeInput(entry.end_time) : "");
    setMenuOpen(null);
  }

  async function handleEdit() {
    if (!editEntry || !editStartTime || !editEndTime) return;
    try {
      await updateTimeEntry(
        editEntry.id,
        editProjectId,
        fromLocalDateTimeInput(editStartTime),
        fromLocalDateTimeInput(editEndTime)
      );
      setEditEntry(null);
      await loadData();
    } catch (error) {
      console.error("Failed to update entry:", error);
    }
  }

  const dayGroups = groupEntriesByDay(entries);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-gray-400 text-sm mt-1">View your tracked time entries</p>
      </header>

      <div className="space-y-6">
        {dayGroups.length === 0 ? (
          <div className="text-center text-gray-400 py-12 bg-[#252525] rounded-xl">
            No time entries yet. Start tracking to see your history.
          </div>
        ) : (
          dayGroups.map((group) => (
            <div key={group.date} className="space-y-3">
              {/* Day header */}
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-300">
                  {group.displayDate}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDuration(group.totalDuration)}
                </span>
              </div>

              {/* Summary bar */}
              <DaySummaryBar breakdown={group.projectBreakdown} />

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
                      <span className="font-medium truncate">{entry.project_name}</span>
                    </div>

                    {/* Time range */}
                    <div className="text-sm text-gray-400 shrink-0">
                      {formatTime(entry.start_time)} -{" "}
                      {entry.end_time ? formatTime(entry.end_time) : "..."}
                    </div>

                    {/* Duration */}
                    <div className="text-sm font-medium text-gray-300 w-20 text-right shrink-0">
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
                        <div className="absolute right-0 top-full mt-1 w-36 bg-[#333] rounded-lg shadow-xl border border-white/10 py-1 z-50">
                          <button
                            onClick={() => openEditModal(entry)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/10"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setDeleteConfirm(entry);
                              setMenuOpen(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/10 text-red-400"
                          >
                            <Trash2 size={14} />
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

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#252525] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold">Delete Entry</h3>
            </div>
            <p className="text-gray-300 mb-2">
              Are you sure you want to delete this time entry?
            </p>
            <p className="text-gray-400 text-sm mb-6">
              <strong>{deleteConfirm.project_name}</strong> - {formatTime(deleteConfirm.start_time)} to {deleteConfirm.end_time ? formatTime(deleteConfirm.end_time) : "..."} ({formatEntryDuration(deleteConfirm.duration || 0)})
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#303030] text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editEntry && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#252525] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Edit Time Entry</h3>
              <button
                onClick={() => setEditEntry(null)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Project selector */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Project</label>
                <select
                  value={editProjectId}
                  onChange={(e) => setEditProjectId(Number(e.target.value))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start time */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Start Time</label>
                <input
                  type="datetime-local"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* End time */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">End Time</label>
                <input
                  type="datetime-local"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setEditEntry(null)}
                className="px-4 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#303030] text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={!editStartTime || !editEndTime}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
