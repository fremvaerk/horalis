import { EntryWithProject, DayGroup, ProjectSummary } from "./types";

// --- FloatingTimer utilities ---

/** Format seconds as "HH:MM:SS" */
export function formatElapsedTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Check if currentMinutes falls within a time window (supports overnight) */
export function isWithinTimeWindow(
  startTime: string,
  endTime: string,
  currentMinutes: number
): boolean {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

/** Check if a day number (0=Sun..6=Sat) is in the allowed weekdays */
export function isAllowedWeekday(
  weekdays: number[],
  currentDay: number
): boolean {
  return weekdays.includes(currentDay);
}

// --- HistoryPage utilities ---

/** Format seconds as "Xh YYmin" (long form) */
export function formatDurationLong(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  }
  return `${m}min`;
}

/** Format seconds as "H:MM:SS" or "M:SS" */
export function formatEntryDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Parse a DB date string (ISO or space-separated) into a Date */
export function parseDbDate(dateStr: string): Date {
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  return new Date(dateStr + "Z");
}

/** Format a DB date string as locale time "HH:MM" */
export function formatTimeOfDay(dateStr: string): string {
  const date = parseDbDate(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Extract the date key "YYYY-MM-DD" from a DB date string */
export function getDateKey(dateStr: string): string {
  if (dateStr.includes("T")) {
    return dateStr.split("T")[0];
  }
  return dateStr.split(" ")[0];
}

/** Format a date key for display (Today/Yesterday/Weekday, DD.MM.YYYY) */
export function formatDisplayDate(dateKey: string, today?: Date): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const todayDate = today ?? new Date();
  const todayStart = new Date(todayDate);
  todayStart.setHours(0, 0, 0, 0);

  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);

  const entryDate = new Date(year, month - 1, day);
  entryDate.setHours(0, 0, 0, 0);

  if (entryDate.getTime() === todayStart.getTime()) {
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

/** Group entries by day, computing totals and project breakdowns */
export function groupEntriesByDay(
  entries: EntryWithProject[],
  today?: Date
): DayGroup[] {
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

    const projectTotals = new Map<
      number,
      { name: string; color: string; seconds: number }
    >();
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

    const projectBreakdown: ProjectSummary[] = Array.from(
      projectTotals.entries()
    )
      .map(([projectId, data]) => ({
        projectId,
        projectName: data.name,
        projectColor: data.color,
        totalSeconds: data.seconds,
        percentage:
          totalDuration > 0 ? (data.seconds / totalDuration) * 100 : 0,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    result.push({
      date: dateKey,
      displayDate: formatDisplayDate(dateKey, today),
      entries: dayEntries,
      totalDuration,
      projectBreakdown,
    });
  }

  return result.sort((a, b) => b.date.localeCompare(a.date));
}

/** Convert a DB date string to a datetime-local input value */
export function toLocalDateTimeInput(dbDateStr: string): string {
  const date = parseDbDate(dbDateStr);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

/** Convert a datetime-local input value to a DB date string */
export function fromLocalDateTimeInput(localDateTimeStr: string): string {
  const date = new Date(localDateTimeStr);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

// --- ReportsPage utilities ---

/** Format seconds as "Xh Ym" (short form) */
export function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

/** Format seconds as "X.Xh" */
export function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  return hours.toFixed(1) + "h";
}

/** Get the week range (Mon-Sun) for a given date */
export function getWeekRange(
  date: Date
): { start: Date; end: Date; label: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const startStr = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endStr = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const label = `${startStr} - ${endStr}, ${start.getFullYear()}`;

  return { start, end, label };
}

/** Get the month range for a given date */
export function getMonthRange(
  date: Date
): { start: Date; end: Date; label: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  const label = start.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return { start, end, label };
}

/** Format a Date as "YYYY-MM-DD" in local time */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// --- db.ts utilities ---

/** Get Monday's date string "YYYY-MM-DD" for the week containing `now` */
export function getMondayDateString(now: Date): string {
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}
