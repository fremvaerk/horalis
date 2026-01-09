import { useEffect, useRef, useState } from "react";
import { GripVertical, Play, Square, ChevronDown } from "lucide-react";
import { useTimerStore } from "../store";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function isWithinTimeWindow(startTime: string, endTime: string): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return currentMinutes >= startH * 60 + startM && currentMinutes <= endH * 60 + endM;
}

function isAllowedWeekday(weekdays: number[]): boolean {
  return weekdays.includes(new Date().getDay());
}

export default function FloatingTimer() {
  const {
    projects,
    selectedProject,
    currentEntry,
    isRunning,
    elapsedSeconds,
    isLoading,
    error,
    settings,
    loadProjects,
    loadSettings,
    loadCurrentEntry,
    selectProject,
    startTimer,
    stopTimer,
    startTimerForProject,
    tick,
  } = useTimerStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const startupHandledRef = useRef(false);

  // Blink effect when timer not running during active hours
  useEffect(() => {
    console.log('[Blink] Settings:', settings, 'isRunning:', isRunning);
    if (!settings?.blink_enabled || isRunning) {
      console.log('[Blink] Skipping - blink_enabled:', settings?.blink_enabled, 'isRunning:', isRunning);
      setIsBlinking(false);
      return;
    }

    const checkAndBlink = () => {
      const inWindow = isWithinTimeWindow(settings.reminder_start_time, settings.reminder_end_time);
      const allowedDay = isAllowedWeekday(settings.reminder_weekdays);
      console.log('[Blink] Checking:', { inWindow, allowedDay, interval: settings.blink_interval_seconds });
      if (inWindow && allowedDay) {
        console.log('[Blink] Triggering blink!');
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 1000);
      }
    };

    // Initial check
    checkAndBlink();
    const interval = setInterval(checkAndBlink, settings.blink_interval_seconds * 1000);
    return () => clearInterval(interval);
  }, [settings, isRunning]);

  // Resize window when dropdown opens/closes
  useEffect(() => {
    if (projects.length === 0) return; // Don't resize until projects loaded
    const win = getCurrentWindow();
    if (dropdownOpen) {
      // Calculate height based on number of projects (each item ~40px + padding)
      const dropdownHeight = Math.min(projects.length * 40 + 16, 200);
      win.setSize(new LogicalSize(272, 44 + dropdownHeight + 8));
    } else {
      win.setSize(new LogicalSize(272, 44));
    }
  }, [dropdownOpen, projects.length]);

  useEffect(() => {
    async function init() {
      // Load settings first to get the show_window_on_startup preference
      const settings = await loadSettings();

      // Handle show_window_on_startup setting (only once at startup)
      if (!startupHandledRef.current) {
        startupHandledRef.current = true;
        if (settings && settings.show_window_on_startup === false) {
          const win = getCurrentWindow();
          win.hide();
        }
      }

      // Then load projects and current entry
      await loadProjects();
      await loadCurrentEntry();
    }
    init();
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

  // Listen for idle timeout from Rust backend
  useEffect(() => {
    const unlisten = listen<number>("idle-timeout", (event) => {
      console.log(`Idle timeout reached: ${event.payload} seconds`);
      stopTimer();
    });
    return () => {
      unlisten.then(fn => fn());
    };
  }, [stopTimer]);

  // Listen for system sleep detection from Rust backend
  useEffect(() => {
    const unlisten = listen<number>("system-sleep", (event) => {
      console.log(`System sleep detected: ${event.payload} seconds`);
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

  if (error) {
    return (
      <div className="h-9 bg-[#1a1a1a] rounded-lg flex items-center justify-center px-2">
        <span className="text-red-400 text-xs truncate" title={error}>Error: {error}</span>
      </div>
    );
  }


  return (
    <div className="relative h-11 select-none">
      {/* Main bar - extends under the button */}
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 h-9 rounded-lg flex items-center px-1.5 gap-1 cursor-grab active:cursor-grabbing transition-colors duration-200 ${
          isBlinking ? 'bg-yellow-600' : 'bg-[#1a1a1a]'
        }`}
        onMouseDown={handleDragStart}
        style={{ width: 'calc(100% - 24px)', paddingTop: '2px', paddingBottom: '2px' }}
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
            <span className={`text-base font-semibold truncate transition-colors duration-200 ${isBlinking ? 'text-black' : 'text-white'}`}>
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
        <div className={`font-mono text-base font-semibold tracking-wider tabular-nums transition-colors duration-200 ${isBlinking ? 'text-black' : 'text-white'}`}>
          {formatTime(elapsedSeconds)}
        </div>

        {/* Spacer to keep timer clear of button overlap */}
        <div className="w-7 shrink-0" />
      </div>

      {/* Play/Stop button - positioned to overlap the edge (half inside, half outside) */}
      <button
        onClick={handleToggleTimer}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={!selectedProject && !isRunning}
        className={`absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-lg ${
          isRunning
            ? "bg-red-500 hover:bg-red-600"
            : "bg-[#5BA4C4] hover:bg-[#4A93B3]"
        } ${!selectedProject && !isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {isRunning ? (
          <Square size={12} className="text-white" fill="white" />
        ) : (
          <Play size={14} className="text-white ml-0.5" fill="white" />
        )}
      </button>
    </div>
  );
}
