import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, FolderKanban, Settings2, Bell } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getProjects, createProject, updateProject, deleteProject, Project, getSettings, updateSetting, AppSettings } from "../../lib/db";

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
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? "bg-blue-600" : "bg-[#404040]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      disabled={disabled}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
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
      await deleteProject(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadData();
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

      // If it's a reminder-related setting, update the reminder system
      if (key.startsWith("reminder_")) {
        await updateReminderSystem(newSettings);
      }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  const tabs = [
    { id: "projects" as const, label: "Projects", icon: FolderKanban },
    { id: "general" as const, label: "General", icon: Settings2 },
    { id: "reminders" as const, label: "Reminders", icon: Bell },
  ];

  async function handleWeekdayToggle(dayValue: number) {
    if (!settings) return;
    const currentDays = settings.reminder_weekdays;
    let newDays: number[];
    if (currentDays.includes(dayValue)) {
      newDays = currentDays.filter((d) => d !== dayValue);
    } else {
      newDays = [...currentDays, dayValue].sort((a, b) => a - b);
    }
    // Save to DB as string
    try {
      await updateSetting("reminder_weekdays", newDays.join(","));
      const newSettings = { ...settings, reminder_weekdays: newDays };
      setSettings(newSettings);
      await updateReminderSystem(newSettings);
    } catch (error) {
      console.error("Failed to update weekdays:", error);
    }
  }

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your projects and preferences</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#1a1a1a] p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[#303030] text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Projects</h2>
            {!isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Add Project
              </button>
            )}
          </div>

          <div className="bg-[#252525] rounded-xl overflow-hidden">
            {/* Add new project form */}
            {isAdding && (
              <div className="px-5 py-4 border-b border-white/5 bg-[#2a2a2a]">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="sr-only"
                      id="new-color"
                    />
                    <label
                      htmlFor="new-color"
                      className="w-8 h-8 rounded-full cursor-pointer block border-2 border-white/20"
                      style={{ backgroundColor: newColor }}
                    />
                  </div>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Project name"
                    className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") setIsAdding(false);
                    }}
                  />
                  <button
                    onClick={handleCreate}
                    className="p-2 hover:bg-white/10 rounded-lg text-green-500"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => setIsAdding(false)}
                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
                  >
                    <X size={18} />
                  </button>
                </div>
                {/* Color presets */}
                <div className="flex gap-2 mt-3 ml-12">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        newColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-[#2a2a2a]" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Project list */}
            {projects.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                No projects yet. Add one to get started.
              </div>
            ) : (
              projects.map((project, index) => (
                <div
                  key={project.id}
                  className={`px-5 py-4 ${
                    index !== projects.length - 1 ? "border-b border-white/5" : ""
                  }`}
                >
                  {editingId === project.id ? (
                    // Edit mode
                    <div>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="sr-only"
                            id={`edit-color-${project.id}`}
                          />
                          <label
                            htmlFor={`edit-color-${project.id}`}
                            className="w-8 h-8 rounded-full cursor-pointer block border-2 border-white/20"
                            style={{ backgroundColor: editColor }}
                          />
                        </div>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdate();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          onClick={handleUpdate}
                          className="p-2 hover:bg-white/10 rounded-lg text-green-500"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      {/* Color presets */}
                      <div className="flex gap-2 mt-3 ml-12">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditColor(color)}
                            className={`w-6 h-6 rounded-full transition-transform ${
                              editColor === color
                                ? "ring-2 ring-white ring-offset-2 ring-offset-[#252525]"
                                : ""
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center gap-4 group">
                      <span
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="flex-1 font-medium">{project.name}</span>
                      <button
                        onClick={() => startEditing(project)}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(project)}
                        className="p-2 hover:bg-white/10 rounded-lg text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
        <div className="space-y-6">
          <div className="bg-[#252525] rounded-xl overflow-hidden">
            {/* Show timer window on startup */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <div className="font-medium">Show timer window on startup</div>
                <div className="text-sm text-gray-400 mt-0.5">
                  Automatically show the floating timer when the app launches
                </div>
              </div>
              <Toggle
                checked={settings.show_window_on_startup}
                onChange={(checked) => handleSettingChange("show_window_on_startup", checked)}
              />
            </div>

            {/* Show timer in system tray */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <div className="font-medium">Show timer in system tray</div>
                <div className="text-sm text-gray-400 mt-0.5">
                  Display the running timer duration next to the tray icon
                </div>
              </div>
              <Toggle
                checked={settings.show_timer_in_tray}
                onChange={(checked) => handleSettingChange("show_timer_in_tray", checked)}
              />
            </div>

            {/* Stop timer when idle */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="font-medium">Stop timer when idle</div>
                <div className="text-sm text-gray-400 mt-0.5">
                  Automatically stop the timer after {settings.idle_timeout_minutes} minutes of inactivity
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
        <div className="space-y-6">
          <div className="bg-[#252525] rounded-xl overflow-hidden">
            {/* Enable reminders */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <div className="font-medium">Enable tracking reminders</div>
                <div className="text-sm text-gray-400 mt-0.5">
                  Get notified when you're not tracking time during work hours
                </div>
              </div>
              <Toggle
                checked={settings.reminder_enabled}
                onChange={(checked) => handleSettingChange("reminder_enabled", checked)}
              />
            </div>

            {/* Reminder interval */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <div className="font-medium">Reminder interval</div>
                <div className="text-sm text-gray-400 mt-0.5">
                  How often to remind (in minutes)
                </div>
              </div>
              <select
                value={settings.reminder_interval_minutes}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  handleSettingChange("reminder_interval_minutes", value);
                  setSettings({ ...settings, reminder_interval_minutes: value });
                }}
                disabled={!settings.reminder_enabled}
                className={`bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${
                  !settings.reminder_enabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
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

            {/* Active hours */}
            <div className="px-5 py-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-medium">Active hours</div>
                  <div className="text-sm text-gray-400 mt-0.5">
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
                    setSettings({ ...settings, reminder_start_time: e.target.value });
                  }}
                  disabled={!settings.reminder_enabled}
                  className={`bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${
                    !settings.reminder_enabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                />
                <span className="text-gray-400">to</span>
                <input
                  type="time"
                  value={settings.reminder_end_time}
                  onChange={(e) => {
                    handleSettingChange("reminder_end_time", e.target.value);
                    setSettings({ ...settings, reminder_end_time: e.target.value });
                  }}
                  disabled={!settings.reminder_enabled}
                  className={`bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${
                    !settings.reminder_enabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                />
              </div>
            </div>

            {/* Active days */}
            <div className="px-5 py-4">
              <div className="mb-3">
                <div className="font-medium">Active days</div>
                <div className="text-sm text-gray-400 mt-0.5">
                  Only remind on these days
                </div>
              </div>
              <div className="flex gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => handleWeekdayToggle(day.value)}
                    disabled={!settings.reminder_enabled}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      settings.reminder_weekdays.includes(day.value)
                        ? "bg-blue-600 text-white"
                        : "bg-[#1a1a1a] text-gray-400 hover:bg-[#303030]"
                    } ${!settings.reminder_enabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#252525] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold">Delete Project</h3>
            </div>
            <p className="text-gray-300 mb-2">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <p className="text-gray-400 text-sm mb-6">
              All time entries for this project will also be permanently deleted.
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
    </div>
  );
}
