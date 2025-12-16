import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import {
  Project,
  TimeEntry,
  getProjects,
  getRunningEntry,
  startTimeEntry,
  stopTimeEntry,
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

      // Try to restore last used project from time entries history
      let defaultProject = selectedProject;
      if (!defaultProject) {
        try {
          const lastProjectId = await getLastUsedProjectId();
          if (lastProjectId) {
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
      // Start native background timer for tray title updates (only if setting enabled)
      if (settings?.show_timer_in_tray !== false) {
        const startTimeMs = Date.now();
        await invoke("start_tray_timer", {
          startTimeMs,
          idleEnabled: settings?.stop_timer_when_idle ?? false,
          idleTimeoutMinutes: settings?.idle_timeout_minutes ?? 5,
        });
      }
      // Update tray menu to enable "Stop Timer"
      await invoke("update_tray_menu", {
        projects: projects.map(p => ({ id: p.id, name: p.name, color: p.color })),
        isRunning: true,
      });
    } catch (e) {
      console.error("Failed to set tray icon color:", e);
    }
  },

  stopTimer: async () => {
    const { currentEntry, projects } = get();
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
      // Start native background timer for tray title updates (only if setting enabled)
      if (settings?.show_timer_in_tray !== false) {
        const startTimeMs = Date.now();
        await invoke("start_tray_timer", {
          startTimeMs,
          idleEnabled: settings?.stop_timer_when_idle ?? false,
          idleTimeoutMinutes: settings?.idle_timeout_minutes ?? 5,
        });
      }
      // Update tray menu to enable "Stop Timer"
      await invoke("update_tray_menu", {
        projects: projects.map(p => ({ id: p.id, name: p.name, color: p.color })),
        isRunning: true,
      });
    } catch (e) {
      console.error("Failed to set tray icon color:", e);
    }
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
          // Start native background timer with the original start time (only if setting enabled)
          if (settings?.show_timer_in_tray !== false) {
            await invoke("start_tray_timer", {
              startTimeMs: startTime,
              idleEnabled: settings?.stop_timer_when_idle ?? false,
              idleTimeoutMinutes: settings?.idle_timeout_minutes ?? 5,
            });
          }
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
    const { selectedProject, projects } = get();
    await deleteProject(id);
    await get().loadProjects();

    if (selectedProject?.id === id) {
      const remaining = projects.filter((p) => p.id !== id);
      set({ selectedProject: remaining[0] || null });
    }
  },
}));
