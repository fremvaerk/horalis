import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, FolderKanban, Settings2, Bell, Pipette } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getProjects, createProject, updateProject, deleteProject, getRunningEntry, stopTimeEntry, Project, getSettings, updateSetting, AppSettings } from "../../lib/db";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const PRESET_COLORS = [
  "#3B82F6", // blue
  "#22C55E", // green
  "#F59E0B", // amber
  "#EC4899", // pink
  "#8B5CF6", // purple
  "#EF4444", // red
  "#14B8A6", // teal
  "#F97316", // orange
];

type TabId = "projects" | "general" | "reminders";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className="relative w-12 h-7 rounded-full transition-all duration-200"
      style={{
        background: checked ? 'var(--accent-primary)' : 'var(--bg-active)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: checked ? 'var(--shadow-glow)' : 'none'
      }}
      disabled={disabled}
    >
      <span
        className="absolute top-1 left-1 w-5 h-5 rounded-full transition-transform duration-200"
        style={{
          background: 'white',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          boxShadow: 'var(--shadow-sm)'
        }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [projectsData, settingsData] = await Promise.all([
        getProjects(),
        getSettings(),
      ]);
      setProjects(projectsData);
      setSettings(settingsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createProject(newName.trim(), newColor);
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
      setIsAdding(false);
      await loadData();
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  }

  async function handleUpdate() {
    if (!editingId || !editName.trim()) return;
    try {
      await updateProject(editingId, editName.trim(), editColor);
      setEditingId(null);
      await loadData();
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      // Check if there's a running timer for this project and stop it first
      const running = await getRunningEntry();
      if (running && running.project_id === deleteConfirm.id) {
        await stopTimeEntry(running.id);
        await invoke("stop_tray_timer");
        await invoke("reset_tray_icon");
        // Notify FloatingTimer to sync its state
        await emit("stop-timer");
      }

      await deleteProject(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadData();

      // Update tray menu after project deletion
      const updatedProjects = await getProjects();
      const isRunning = !!(await getRunningEntry());
      await invoke("update_tray_menu", {
        projects: updatedProjects.map(p => ({ id: p.id, name: p.name, color: p.color })),
        isRunning,
      });
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  }

  async function handleSettingChange(key: keyof AppSettings, value: boolean | number | string) {
    if (!settings) return;
    try {
      await updateSetting(key, String(value));
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);

      if (key.startsWith("reminder_")) {
        await updateReminderSystem(newSettings);
      }

      // Notify other windows (FloatingTimer) about settings changes
      await emit("settings-changed");
    } catch (error) {
      console.error("Failed to update setting:", error);
    }
  }

  async function updateReminderSystem(newSettings: AppSettings) {
    try {
      await invoke("start_reminder", {
        config: {
          enabled: newSettings.reminder_enabled,
          interval_minutes: newSettings.reminder_interval_minutes,
          start_time: newSettings.reminder_start_time,
          end_time: newSettings.reminder_end_time,
          weekdays: newSettings.reminder_weekdays,
        },
      });
    } catch (error) {
      console.error("Failed to update reminder:", error);
    }
  }

  function startEditing(project: Project) {
    setEditingId(project.id);
    setEditName(project.name);
    setEditColor(project.color);
  }

  async function handleWeekdayToggle(dayValue: number) {
    if (!settings) return;
    const currentDays = settings.reminder_weekdays;
    let newDays: number[];
    if (currentDays.includes(dayValue)) {
      newDays = currentDays.filter((d) => d !== dayValue);
    } else {
      newDays = [...currentDays, dayValue].sort((a, b) => a - b);
    }
    try {
      await updateSetting("reminder_weekdays", newDays.join(","));
      const newSettings = { ...settings, reminder_weekdays: newDays };
      setSettings(newSettings);
      await updateReminderSystem(newSettings);
      await emit("settings-changed");
    } catch (error) {
      console.error("Failed to update weekdays:", error);
    }
  }

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

  const tabs = [
    { id: "projects" as const, label: "Projects", icon: FolderKanban },
    { id: "general" as const, label: "General", icon: Settings2 },
    { id: "reminders" as const, label: "Reminders", icon: Bell },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <header className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-primary-muted)' }}
          >
            <Settings2 size={18} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Manage your projects and preferences
            </p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-8 p-1.5 rounded-xl w-fit animate-fade-in-up"
        style={{ background: 'var(--bg-surface)', animationDelay: '50ms' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-semibold">Projects</h2>
            {!isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  background: 'var(--accent-primary)',
                  color: 'var(--bg-base)'
                }}
                onMouseOver={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-glow)'}
                onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <Plus size={16} />
                Add Project
              </button>
            )}
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            {/* Add form */}
            {isAdding && (
              <div
                className="px-5 py-5"
                style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl shrink-0"
                    style={{ backgroundColor: newColor, boxShadow: 'var(--shadow-sm)' }}
                  />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Project name"
                    className="flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)'
                    }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") setIsAdding(false);
                    }}
                  />
                  <button
                    onClick={handleCreate}
                    className="p-2.5 rounded-xl transition-colors"
                    style={{ background: 'var(--accent-success-muted)', color: 'var(--accent-success)' }}
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => setIsAdding(false)}
                    className="p-2.5 rounded-xl transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <X size={18} />
                  </button>
                </div>
                {/* Colors */}
                <div className="flex items-center gap-2 mt-4 ml-14">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className="w-7 h-7 rounded-lg transition-all duration-200"
                      style={{
                        backgroundColor: color,
                        transform: newColor === color ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: newColor === color ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${color}` : 'none'
                      }}
                    />
                  ))}
                  <div className="relative">
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button
                      className="w-7 h-7 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors"
                      style={{
                        borderColor: !PRESET_COLORS.includes(newColor) ? newColor : 'var(--text-faint)',
                        backgroundColor: !PRESET_COLORS.includes(newColor) ? newColor : 'transparent'
                      }}
                    >
                      <Pipette size={12} style={{ color: !PRESET_COLORS.includes(newColor) ? 'white' : 'var(--text-faint)' }} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Project list */}
            {projects.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                <FolderKanban size={40} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
                <p>No projects yet. Add one to get started.</p>
              </div>
            ) : (
              projects.map((project, index) => (
                <div
                  key={project.id}
                  className="px-5 py-4 transition-colors duration-150"
                  style={{
                    borderBottom: index !== projects.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                  }}
                  onMouseOver={(e) => { if (editingId !== project.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseOut={(e) => { if (editingId !== project.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  {editingId === project.id ? (
                    <div>
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-xl shrink-0"
                          style={{ backgroundColor: editColor, boxShadow: 'var(--shadow-sm)' }}
                        />
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)'
                          }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdate();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          onClick={handleUpdate}
                          className="p-2.5 rounded-xl transition-colors"
                          style={{ background: 'var(--accent-success-muted)', color: 'var(--accent-success)' }}
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2.5 rounded-xl transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-4 ml-14">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditColor(color)}
                            className="w-7 h-7 rounded-lg transition-all duration-200"
                            style={{
                              backgroundColor: color,
                              transform: editColor === color ? 'scale(1.1)' : 'scale(1)',
                              boxShadow: editColor === color ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${color}` : 'none'
                            }}
                          />
                        ))}
                        <div className="relative">
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <button
                            className="w-7 h-7 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors"
                            style={{
                              borderColor: !PRESET_COLORS.includes(editColor) ? editColor : 'var(--text-faint)',
                              backgroundColor: !PRESET_COLORS.includes(editColor) ? editColor : 'transparent'
                            }}
                          >
                            <Pipette size={12} style={{ color: !PRESET_COLORS.includes(editColor) ? 'white' : 'var(--text-faint)' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 group">
                      <div
                        className="w-4 h-4 rounded-md shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="flex-1 font-medium">{project.name}</span>
                      <button
                        onClick={() => startEditing(project)}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-active)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(project)}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        style={{ color: 'var(--accent-danger)' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-danger-muted)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* General Tab */}
      {activeTab === "general" && settings && (
        <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div className="font-medium mb-1">Show timer window on startup</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Automatically show the floating timer when the app launches
                </div>
              </div>
              <Toggle
                checked={settings.show_window_on_startup}
                onChange={(checked) => handleSettingChange("show_window_on_startup", checked)}
              />
            </div>

            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div className="font-medium mb-1">Show timer in system tray</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Display the running timer duration next to the tray icon
                </div>
              </div>
              <Toggle
                checked={settings.show_timer_in_tray}
                onChange={(checked) => handleSettingChange("show_timer_in_tray", checked)}
              />
            </div>

            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <div className="font-medium mb-1">Stop timer when idle</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Automatically stop after {settings.idle_timeout_minutes} minutes of inactivity
                </div>
              </div>
              <Toggle
                checked={settings.stop_timer_when_idle}
                onChange={(checked) => handleSettingChange("stop_timer_when_idle", checked)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Reminders Tab */}
      {activeTab === "reminders" && settings && (
        <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div className="font-medium mb-1">Enable tracking reminders</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Get notified when you're not tracking time during work hours
                </div>
              </div>
              <Toggle
                checked={settings.reminder_enabled}
                onChange={(checked) => handleSettingChange("reminder_enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div className="font-medium mb-1">Reminder interval</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  How often to remind you
                </div>
              </div>
              <select
                value={settings.reminder_interval_minutes}
                onChange={(e) => {
                  handleSettingChange("reminder_interval_minutes", parseInt(e.target.value, 10));
                }}
                disabled={!settings.reminder_enabled}
                className="rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  opacity: !settings.reminder_enabled ? 0.5 : 1,
                  cursor: !settings.reminder_enabled ? 'not-allowed' : 'pointer'
                }}
              >
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-medium mb-1">Active hours</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Only remind during these hours
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={settings.reminder_start_time}
                  onChange={(e) => {
                    handleSettingChange("reminder_start_time", e.target.value);
                  }}
                  disabled={!settings.reminder_enabled}
                  className="rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    opacity: !settings.reminder_enabled ? 0.5 : 1,
                    cursor: !settings.reminder_enabled ? 'not-allowed' : 'pointer'
                  }}
                />
                <span style={{ color: 'var(--text-muted)' }}>to</span>
                <input
                  type="time"
                  value={settings.reminder_end_time}
                  onChange={(e) => {
                    handleSettingChange("reminder_end_time", e.target.value);
                  }}
                  disabled={!settings.reminder_enabled}
                  className="rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    opacity: !settings.reminder_enabled ? 0.5 : 1,
                    cursor: !settings.reminder_enabled ? 'not-allowed' : 'pointer'
                  }}
                />
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="mb-4">
                <div className="font-medium mb-1">Active days</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Only remind on these days
                </div>
              </div>
              <div className="flex gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => handleWeekdayToggle(day.value)}
                    disabled={!settings.reminder_enabled}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{
                      background: settings.reminder_weekdays.includes(day.value) ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      color: settings.reminder_weekdays.includes(day.value) ? 'var(--bg-base)' : 'var(--text-muted)',
                      opacity: !settings.reminder_enabled ? 0.5 : 1,
                      cursor: !settings.reminder_enabled ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visual Alerts */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-faint)' }}
              >
                Visual Alerts
              </h3>
            </div>

            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div className="font-medium mb-1">Blink timer window</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Flash the timer window when not tracking during active hours
                </div>
              </div>
              <Toggle
                checked={settings.blink_enabled}
                onChange={(checked) => handleSettingChange("blink_enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <div className="font-medium mb-1">Blink interval</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  How often to blink
                </div>
              </div>
              <select
                value={settings.blink_interval_seconds}
                onChange={(e) => {
                  handleSettingChange("blink_interval_seconds", parseInt(e.target.value, 10));
                }}
                disabled={!settings.blink_enabled}
                className="rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  opacity: !settings.blink_enabled ? 0.5 : 1,
                  cursor: !settings.blink_enabled ? 'not-allowed' : 'pointer'
                }}
              >
                <option value={15}>15 sec</option>
                <option value={30}>30 sec</option>
                <option value={45}>45 sec</option>
                <option value={60}>1 min</option>
                <option value={90}>1.5 min</option>
                <option value={120}>2 min</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
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
                <h3 className="text-lg font-semibold">Delete Project</h3>
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
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: deleteConfirm.color }}
                />
                <span className="font-medium">{deleteConfirm.name}</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                All time entries for this project will also be permanently deleted.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
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
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
