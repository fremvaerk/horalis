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
} from "../lib/db";

interface TimerState {
  projects: Project[];
  selectedProject: Project | null;
  currentEntry: (TimeEntry & { project_name: string; project_color: string }) | null;
  isRunning: boolean;
  elapsedSeconds: number;
  isLoading: boolean;

  // Actions
  loadProjects: () => Promise<void>;
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

  loadProjects: async () => {
    try {
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
      set({ isLoading: false, projects: [] });
    }
  },

  selectProject: (project) => {
    set({ selectedProject: project });
  },

  startTimer: async () => {
    const { selectedProject, projects } = get();
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
    // Clear tray title and reset icon after state update
    try {
      await invoke("clear_tray_title");
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
    const { currentEntry, projects } = get();

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
  },

  loadCurrentEntry: async () => {
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
      } catch (e) {
        console.error("Failed to set tray icon color:", e);
      }
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
