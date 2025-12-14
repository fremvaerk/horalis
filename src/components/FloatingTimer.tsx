import { useEffect, useRef, useState } from "react";
import { GripVertical, Play, Square, ChevronDown } from "lucide-react";
import { useTimerStore } from "../store";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatTrayTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export default function FloatingTimer() {
  const {
    projects,
    selectedProject,
    currentEntry,
    isRunning,
    elapsedSeconds,
    isLoading,
    loadProjects,
    loadCurrentEntry,
    selectProject,
    startTimer,
    stopTimer,
    startTimerForProject,
    tick,
  } = useTimerStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Resize window when dropdown opens/closes
  useEffect(() => {
    if (projects.length === 0) return; // Don't resize until projects loaded
    const win = getCurrentWindow();
    if (dropdownOpen) {
      // Calculate height based on number of projects (each item ~40px + padding)
      const dropdownHeight = Math.min(projects.length * 40 + 16, 200);
      win.setSize(new LogicalSize(240, 44 + dropdownHeight + 8));
    } else {
      win.setSize(new LogicalSize(240, 44));
    }
  }, [dropdownOpen, projects.length]);

  useEffect(() => {
    loadProjects();
    loadCurrentEntry();
  }, []);

  // Listen for tray menu project clicks
  useEffect(() => {
    const unlisten = listen<number>("start-project-timer", (event) => {
      startTimerForProject(event.payload);
    });
    return () => {
      unlisten.then(fn => fn());
    };
  }, [startTimerForProject]);

  // Listen for tray menu stop timer
  useEffect(() => {
    const unlisten = listen("stop-timer", () => {
      stopTimer();
    });
    return () => {
      unlisten.then(fn => fn());
    };
  }, [stopTimer]);

  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  // Update tray title when timer is running (only update when minutes change)
  useEffect(() => {
    if (isRunning) {
      invoke("set_tray_title", { title: formatTrayTime(elapsedSeconds) });
    }
  }, [isRunning, Math.floor(elapsedSeconds / 60)]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleTimer = async () => {
    if (isRunning) {
      await stopTimer();
    } else {
      await startTimer();
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    getCurrentWindow().startDragging();
  };

  const displayProject = isRunning && currentEntry
    ? { name: currentEntry.project_name, color: currentEntry.project_color }
    : selectedProject;

  if (isLoading) {
    return (
      <div className="h-9 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
        <span className="text-gray-400 text-xs">Loading...</span>
      </div>
    );
  }


  return (
    <div
      className="h-9 bg-[#1a1a1a] rounded-lg flex items-center px-1.5 gap-1 select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleDragStart}
      style={{ paddingTop: '2px', paddingBottom: '2px' }}
    >
      {/* Drag handle */}
      <div className="p-0.5 text-gray-500">
        <GripVertical size={14} />
      </div>

      {/* Project selector */}
      <div className="relative flex-1 min-w-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 px-1.5 py-1 rounded w-full text-left hover:bg-white/5 cursor-pointer"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: displayProject?.color || "#3B82F6" }}
          />
          <span className="text-white text-base font-semibold truncate">
            {displayProject?.name || "Select"}
          </span>
          <ChevronDown size={10} className="text-gray-400 shrink-0 ml-auto" />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-36 bg-[#252525] rounded-lg shadow-xl border border-white/10 py-2 z-50 max-h-48 overflow-y-auto">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  if (isRunning) {
                    // Switch to new project (stop current and start new)
                    startTimerForProject(project.id);
                  } else {
                    selectProject(project);
                  }
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left ${
                  (isRunning ? currentEntry?.project_id : selectedProject?.id) === project.id ? "bg-white/5" : ""
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="text-white text-base font-medium truncate">{project.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timer display */}
      <div className="font-mono text-white text-base font-semibold tracking-wider tabular-nums">
        {formatTime(elapsedSeconds)}
      </div>

      {/* Play/Stop button */}
      <button
        onClick={handleToggleTimer}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={!selectedProject && !isRunning}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
          isRunning
            ? "bg-red-500 hover:bg-red-600"
            : "bg-[#5BA4C4] hover:bg-[#4A93B3]"
        } ${!selectedProject && !isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {isRunning ? (
          <Square size={10} className="text-white" fill="white" />
        ) : (
          <Play size={12} className="text-white ml-0.5" fill="white" />
        )}
      </button>
    </div>
  );
}
