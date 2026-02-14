import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import {
  Project,
  TimeEntry,
  getProjects,
  getRunningEntry,
  startTimeEntry,
  stopTimeEntry,
  stopTimeEntryAtTime,
  createProject,
  updateProject,
  deleteProject,
  getLastUsedProjectId,
  getSettings,
  AppSettings,
} from "../lib/db";

interface TimerState {
  projects: Project[];
  selectedProject: Project | null;
  currentEntry: (TimeEntry & { project_name: string; project_color: string }) | null;
  isRunning: boolean;
  elapsedSeconds: number;
  isLoading: boolean;
  error: string | null;
  settings: AppSettings | null;

  // Actions
  loadProjects: () => Promise<void>;
  loadSettings: () => Promise<AppSettings | null>;
  selectProject: (project: Project) => void;
  startTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  stopTimerAdjusted: (idleSeconds: number) => Promise<void>;
  startTimerForProject: (projectId: number) => Promise<void>;
  tick: () => void;
  loadCurrentEntry: () => Promise<void>;
  addProject: (name: string, color: string) => Promise<void>;
  editProject: (id: number, name: string, color: string) => Promise<void>;
  removeProject: (id: number) => Promise<void>;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  projects: [],
  selectedProject: null,
  currentEntry: null,
  isRunning: false,
  elapsedSeconds: 0,
  isLoading: true,
  error: null,
  settings: null,

  loadProjects: async () => {
    try {
      set({ error: null });
      const projects = await getProjects();
      const { selectedProject } = get();

      // Try to restore selected project, verifying it still exists
      let defaultProject = selectedProject && projects.find(p => p.id === selectedProject.id)
        ? selectedProject
        : null;
      if (!defaultProject) {
        try {
          const lastProjectId = await getLastUsedProjectId();
          if (lastProjectId != null) {
            defaultProject = projects.find(p => p.id === lastProjectId) || null;
          }
        } catch (e) {
          console.error("Failed to get last used project:", e);
        }
        if (!defaultProject) {
          defaultProject = projects[0] || null;
        }
      }

      set({
        projects,
        selectedProject: defaultProject,
        isLoading: false,
      });

      // Update tray menu with projects
      try {
        const { isRunning } = get();
        await invoke("update_tray_menu", {
          projects: projects.map(p => ({ id: p.id, name: p.name, color: p.color })),
          isRunning,
        });
      } catch (e) {
        console.error("Failed to update tray menu:", e);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ isLoading: false, projects: [], error: `Failed to load: ${errorMessage}` });
    }
  },

  loadSettings: async () => {
    try {
      const settings = await getSettings();
      set({ settings });

      // Initialize reminder system with settings
      try {
        await invoke("start_reminder", {
          config: {
            enabled: settings.reminder_enabled,
            interval_minutes: settings.reminder_interval_minutes,
            start_time: settings.reminder_start_time,
            end_time: settings.reminder_end_time,
            weekdays: settings.reminder_weekdays,
          },
        });
      } catch (e) {
        console.error("Failed to start reminder:", e);
      }

      return settings;
    } catch (error) {
      console.error("Failed to load settings:", error);
      return null;
    }
  },

  selectProject: (project) => {
    set({ selectedProject: project });
  },

  startTimer: async () => {
    const { selectedProject, projects, settings } = get();
    if (!selectedProject) return;

    await startTimeEntry(selectedProject.id);
    const entry = await getRunningEntry();
    set({
      currentEntry: entry,
      isRunning: true,
      elapsedSeconds: 0,
    });
    // Set tray icon to project color with first letter
    try {
      await invoke("set_tray_icon_color", { color: selectedProject.color, name: selectedProject.name });
      // Always start native background timer (needed for sleep detection even when tray title is off)
      const startTimeMs = Date.now();
      await invoke("start_tray_timer", {
        startTimeMs,
        idleEnabled: settings?.stop_timer_when_idle ?? false,
        idleTimeoutMinutes: settings?.idle_timeout_minutes ?? 5,
        showTrayTitle: settings?.show_timer_in_tray !== false,
      });
      // Update tray menu to enable "Stop Timer"
      await invoke("update_tray_menu", {
        projects: projects.map(p => ({ id: p.id, name: p.name, color: p.color })),
        isRunning: true,
      });
    } catch (e) {
      console.error("Failed to set tray icon color:", e);
    }
    await emit("timer-state-changed");
  },

  stopTimer: async () => {
    const { currentEntry, projects, loadSettings } = get();
    if (!currentEntry) return;

    await stopTimeEntry(currentEntry.id);
    set({
      currentEntry: null,
      isRunning: false,
      elapsedSeconds: 0,
    });
    // Stop native background timer and reset tray
    try {
      await invoke("stop_tray_timer");
      await invoke("reset_tray_icon");
      // Update tray menu to disable "Stop Timer"
      await invoke("update_tray_menu", {
        projects: projects.map(p => ({ id: p.id, name: p.name, color: p.color })),
        isRunning: false,
      });
    } catch (e) {
      console.error("Failed to clear tray:", e);
    }
    // Reload settings to get latest blink configuration
    await loadSettings();
    await emit("timer-state-changed");
  },

  stopTimerAdjusted: async (idleSeconds: number) => {
    const { currentEntry, projects, loadSettings } = get();
    if (!currentEntry) return;

    // Calculate adjusted end time by subtracting idle/sleep seconds
    const adjustedEnd = new Date(Date.now() - idleSeconds * 1000);
    const endTimeUtc = adjustedEnd.toISOString().replace("T", " ").slice(0, 19);
    await stopTimeEntryAtTime(currentEntry.id, endTimeUtc);

    set({
      currentEntry: null,
      isRunning: false,
      elapsedSeconds: 0,
    });
    try {
      await invoke("stop_tray_timer");
      await invoke("reset_tray_icon");
      await invoke("update_tray_menu", {
        projects: projects.map(p => ({ id: p.id, name: p.name, color: p.color })),
        isRunning: false,
      });
    } catch (e) {
      console.error("Failed to clear tray:", e);
    }
    await loadSettings();
    await emit("timer-state-changed");
  },

  startTimerForProject: async (projectId: number) => {
    const { currentEntry, projects, settings } = get();

    // Stop any running timer first
    if (currentEntry) {
      await stopTimeEntry(currentEntry.id);
    }

    // Find the project
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Start new timer
    await startTimeEntry(projectId);
    const entry = await getRunningEntry();
    set({
      currentEntry: entry,
      isRunning: true,
      elapsedSeconds: 0,
      selectedProject: project,
    });

    // Set tray icon to project color with first letter
    try {
      await invoke("set_tray_icon_color", { color: project.color, name: project.name });
      // Always start native background timer
      const startTimeMs = Date.now();
      await invoke("start_tray_timer", {
        startTimeMs,
        idleEnabled: settings?.stop_timer_when_idle ?? false,
        idleTimeoutMinutes: settings?.idle_timeout_minutes ?? 5,
        showTrayTitle: settings?.show_timer_in_tray !== false,
      });
      // Update tray menu to enable "Stop Timer"
      await invoke("update_tray_menu", {
        projects: projects.map(p => ({ id: p.id, name: p.name, color: p.color })),
        isRunning: true,
      });
    } catch (e) {
      console.error("Failed to set tray icon color:", e);
    }
    await emit("timer-state-changed");
  },

  tick: () => {
    const { isRunning, currentEntry } = get();
    if (!isRunning || !currentEntry) return;

    const startTime = new Date(currentEntry.start_time + "Z").getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    set({ elapsedSeconds: elapsed });
    // Note: Tray title updates are now handled by native Rust background timer
  },

  loadCurrentEntry: async () => {
    try {
      const { settings } = get();
      const entry = await getRunningEntry();
      if (entry) {
        const startTime = new Date(entry.start_time + "Z").getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        set({
          currentEntry: entry,
          isRunning: true,
          elapsedSeconds: elapsed,
        });
        // Set tray icon to project color with first letter if timer is running
        try {
          await invoke("set_tray_icon_color", { color: entry.project_color, name: entry.project_name });
          // Always start native background timer for sleep detection
          await invoke("start_tray_timer", {
            startTimeMs: startTime,
            idleEnabled: settings?.stop_timer_when_idle ?? false,
            idleTimeoutMinutes: settings?.idle_timeout_minutes ?? 5,
            showTrayTitle: settings?.show_timer_in_tray !== false,
          });
        } catch (e) {
          console.error("Failed to set tray icon color:", e);
        }
      }
    } catch (error) {
      console.error("Failed to load current entry:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ error: `Failed to load entry: ${errorMessage}` });
    }
  },

  addProject: async (name, color) => {
    await createProject(name, color);
    await get().loadProjects();
  },

  editProject: async (id, name, color) => {
    await updateProject(id, name, color);
    await get().loadProjects();
  },

  removeProject: async (id) => {
    await deleteProject(id);
    // loadProjects validates selectedProject still exists and falls back automatically
    await get().loadProjects();
  },
}));
