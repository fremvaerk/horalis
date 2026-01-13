import { useEffect, useState } from "react";
import { MoreVertical, Trash2, Pencil, AlertTriangle, X, Square, Clock, Calendar } from "lucide-react";
import { getTimeEntries, getProjects, deleteTimeEntry, updateTimeEntry, getRunningEntry, stopTimeEntry, TimeEntry, Project } from "../../lib/db";
import { invoke } from "@tauri-apps/api/core";

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
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${weekday}, ${d}.${m}.${y}`;
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
      <div
        className="flex h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--bg-surface)' }}
      >
        {breakdown.map((project, index) => (
          <div
            key={project.projectId}
            className="relative h-full transition-all duration-200 hover:opacity-80 cursor-pointer"
            style={{
              backgroundColor: project.projectColor,
              width: `${Math.max(project.percentage, 2)}%`,
              marginLeft: index > 0 ? "2px" : 0,
            }}
            onMouseEnter={() => setHoveredProject(project)}
            onMouseLeave={() => setHoveredProject(null)}
          />
        ))}
      </div>

      {hoveredProject && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-50 animate-fade-in"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: hoveredProject.projectColor }}
            />
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {hoveredProject.projectName}
            </span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {formatDuration(hoveredProject.totalSeconds)}
            </span>
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
  const [runningEntry, setRunningEntry] = useState<EntryWithProject | null>(null);
  const [runningElapsed, setRunningElapsed] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!runningEntry) return;

    const interval = setInterval(() => {
      const startTime = parseDbDate(runningEntry.start_time).getTime();
      const now = Date.now();
      setRunningElapsed(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [runningEntry]);

  async function loadData() {
    try {
      const [entriesData, projectsData, running] = await Promise.all([
        getTimeEntries(200),
        getProjects(),
        getRunningEntry(),
      ]);
      setEntries(entriesData);
      setProjects(projectsData);
      setRunningEntry(running);
      if (running) {
        const startTime = parseDbDate(running.start_time).getTime();
        setRunningElapsed(Math.floor((Date.now() - startTime) / 1000));
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStopTimer() {
    if (!runningEntry) return;
    try {
      await stopTimeEntry(runningEntry.id);
      await invoke("stop_tray_timer");
      await invoke("reset_tray_icon");
      await invoke("update_tray_menu", {
        projects: projects.map(p => ({ id: p.id, name: p.name, color: p.color })),
        isRunning: false,
      });
      setRunningEntry(null);
      setRunningElapsed(0);
      await loadData();
    } catch (error) {
      console.error("Failed to stop timer:", error);
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
        <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--border-default)',
              borderTopColor: 'var(--accent-primary)'
            }}
          />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <header className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'var(--accent-primary-muted)',
            }}
          >
            <Clock size={18} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">History</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Your tracked time entries
            </p>
          </div>
        </div>
      </header>

      {/* Running timer card */}
      {runningEntry && (
        <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: 'var(--accent-success)' }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ background: 'var(--accent-success)' }}
              />
            </span>
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--accent-success)' }}
            >
              Currently Running
            </span>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--accent-success)',
              boxShadow: '0 0 30px rgba(34, 197, 94, 0.1)'
            }}
          >
            <div className="flex items-center gap-5 px-6 py-5">
              {/* Project */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-4 h-4 rounded-md shrink-0"
                  style={{ backgroundColor: runningEntry.project_color }}
                />
                <span className="font-medium text-lg truncate">
                  {runningEntry.project_name}
                </span>
              </div>

              {/* Start time */}
              <div
                className="flex items-center gap-2 text-sm shrink-0 px-3 py-1.5 rounded-lg"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)'
                }}
              >
                <Clock size={14} />
                Started {formatTime(runningEntry.start_time)}
              </div>

              {/* Duration */}
              <div
                className="text-2xl font-semibold w-28 text-right shrink-0 tabular-nums tracking-tight"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-success)'
                }}
              >
                {formatEntryDuration(runningElapsed)}
              </div>

              {/* Stop button */}
              <button
                onClick={handleStopTimer}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0"
                style={{
                  background: 'var(--accent-danger)',
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                title="Stop timer"
              >
                <Square size={14} className="text-white" fill="white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day groups */}
      <div className="space-y-8">
        {dayGroups.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl animate-fade-in-up"
            style={{ background: 'var(--bg-card)' }}
          >
            <Calendar
              size={48}
              className="mx-auto mb-4"
              style={{ color: 'var(--text-faint)' }}
            />
            <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              No time entries yet
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Start tracking to see your history
            </p>
          </div>
        ) : (
          dayGroups.map((group, groupIndex) => (
            <div
              key={group.date}
              className="space-y-4 animate-fade-in-up"
              style={{ animationDelay: `${(groupIndex + 1) * 50}ms` }}
            >
              {/* Day header */}
              <div className="flex justify-between items-center px-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {group.displayDate}
                </span>
                <span
                  className="text-xs px-2 py-1 rounded-md"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {formatDuration(group.totalDuration)}
                </span>
              </div>

              {/* Summary bar */}
              <DaySummaryBar breakdown={group.projectBreakdown} />

              {/* Entries */}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {group.entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 px-5 py-4 group transition-colors duration-150"
                    style={{
                      borderBottom: index !== group.entries.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Project */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-md shrink-0"
                        style={{ backgroundColor: entry.project_color }}
                      />
                      <span className="font-medium truncate">{entry.project_name}</span>
                    </div>

                    {/* Time range */}
                    <div
                      className="text-sm shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {formatTime(entry.start_time)} - {entry.end_time ? formatTime(entry.end_time) : "..."}
                    </div>

                    {/* Duration */}
                    <div
                      className="text-sm font-medium w-20 text-right shrink-0 tabular-nums"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {formatEntryDuration(entry.duration || 0)}
                    </div>

                    {/* Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === entry.id ? null : entry.id)}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-active)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {menuOpen === entry.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-40 rounded-xl py-1.5 z-50 animate-scale-in"
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-default)',
                            boxShadow: 'var(--shadow-lg)'
                          }}
                        >
                          <button
                            onClick={() => openEditModal(entry)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                            style={{ color: 'var(--text-secondary)' }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'var(--bg-hover)';
                              e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                          >
                            <Pencil size={14} />
                            Edit entry
                          </button>
                          <button
                            onClick={() => {
                              setDeleteConfirm(entry);
                              setMenuOpen(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                            style={{ color: 'var(--accent-danger)' }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-danger-muted)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
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
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="rounded-2xl p-6 max-w-sm w-full mx-4 animate-scale-in"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--accent-danger-muted)' }}
              >
                <AlertTriangle size={22} style={{ color: 'var(--accent-danger)' }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Delete Entry</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div
              className="p-4 rounded-xl mb-6"
              style={{ background: 'var(--bg-surface)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: deleteConfirm.project_color }}
                />
                <span className="font-medium">{deleteConfirm.project_name}</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {formatTime(deleteConfirm.start_time)} - {deleteConfirm.end_time ? formatTime(deleteConfirm.end_time) : "..."}
                <span className="mx-2">·</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatEntryDuration(deleteConfirm.duration || 0)}
                </span>
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ background: 'var(--accent-danger)' }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              >
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editEntry && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="rounded-2xl p-6 max-w-md w-full mx-4 animate-scale-in"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Edit Time Entry</h3>
              <button
                onClick={() => setEditEntry(null)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Project
                </label>
                <select
                  value={editProjectId}
                  onChange={(e) => setEditProjectId(Number(e.target.value))}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setEditEntry(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={!editStartTime || !editEndTime}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--accent-primary)',
                  color: 'var(--bg-base)'
                }}
                onMouseOver={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                  }
                }}
                onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
