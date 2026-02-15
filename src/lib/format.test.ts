import { describe, it, expect } from "vitest";
import {
  formatElapsedTime,
  isWithinTimeWindow,
  isAllowedWeekday,
  formatDurationLong,
  formatEntryDuration,
  parseDbDate,
  formatTimeOfDay,
  getDateKey,
  formatDisplayDate,
  groupEntriesByDay,
  toLocalDateTimeInput,
  fromLocalDateTimeInput,
  formatDurationShort,
  formatHours,
  getWeekRange,
  getMonthRange,
  toLocalDateString,
  getMondayDateString,
} from "./format";
import { EntryWithProject } from "./types";

// --- formatElapsedTime ---
describe("formatElapsedTime", () => {
  it("formats zero seconds", () => {
    expect(formatElapsedTime(0)).toBe("00:00:00");
  });
  it("formats seconds only", () => {
    expect(formatElapsedTime(45)).toBe("00:00:45");
  });
  it("formats minutes and seconds", () => {
    expect(formatElapsedTime(125)).toBe("00:02:05");
  });
  it("formats hours, minutes, and seconds", () => {
    expect(formatElapsedTime(3661)).toBe("01:01:01");
  });
  it("formats large values", () => {
    expect(formatElapsedTime(86399)).toBe("23:59:59");
  });
  it("pads single digits", () => {
    expect(formatElapsedTime(1)).toBe("00:00:01");
  });
});

// --- isWithinTimeWindow ---
describe("isWithinTimeWindow", () => {
  it("returns true inside normal window", () => {
    expect(isWithinTimeWindow("09:00", "18:00", 10 * 60)).toBe(true); // 10:00
  });
  it("returns false outside normal window (before)", () => {
    expect(isWithinTimeWindow("09:00", "18:00", 8 * 60)).toBe(false); // 08:00
  });
  it("returns false outside normal window (after)", () => {
    expect(isWithinTimeWindow("09:00", "18:00", 19 * 60)).toBe(false); // 19:00
  });
  it("returns true at start boundary", () => {
    expect(isWithinTimeWindow("09:00", "18:00", 9 * 60)).toBe(true);
  });
  it("returns true at end boundary", () => {
    expect(isWithinTimeWindow("09:00", "18:00", 18 * 60)).toBe(true);
  });
  it("returns true inside overnight window (late)", () => {
    expect(isWithinTimeWindow("22:00", "06:00", 23 * 60)).toBe(true); // 23:00
  });
  it("returns true inside overnight window (early)", () => {
    expect(isWithinTimeWindow("22:00", "06:00", 3 * 60)).toBe(true); // 03:00
  });
  it("returns false outside overnight window", () => {
    expect(isWithinTimeWindow("22:00", "06:00", 12 * 60)).toBe(false); // 12:00
  });
  it("returns true at overnight start boundary", () => {
    expect(isWithinTimeWindow("22:00", "06:00", 22 * 60)).toBe(true);
  });
  it("returns true at overnight end boundary", () => {
    expect(isWithinTimeWindow("22:00", "06:00", 6 * 60)).toBe(true);
  });
});

// --- isAllowedWeekday ---
describe("isAllowedWeekday", () => {
  it("returns true when day is in list", () => {
    expect(isAllowedWeekday([1, 2, 3, 4, 5], 3)).toBe(true); // Wednesday
  });
  it("returns false when day is not in list", () => {
    expect(isAllowedWeekday([1, 2, 3, 4, 5], 0)).toBe(false); // Sunday
  });
  it("returns false for empty list", () => {
    expect(isAllowedWeekday([], 1)).toBe(false);
  });
  it("handles Saturday (6)", () => {
    expect(isAllowedWeekday([0, 6], 6)).toBe(true);
  });
});

// --- formatDurationLong ---
describe("formatDurationLong", () => {
  it("formats zero as 0min", () => {
    expect(formatDurationLong(0)).toBe("0min");
  });
  it("formats sub-hour", () => {
    expect(formatDurationLong(300)).toBe("5min");
  });
  it("formats exactly one hour", () => {
    expect(formatDurationLong(3600)).toBe("1h 00min");
  });
  it("formats hours and minutes", () => {
    expect(formatDurationLong(5400)).toBe("1h 30min");
  });
  it("pads minutes to 2 digits", () => {
    expect(formatDurationLong(3660)).toBe("1h 01min");
  });
});

// --- formatEntryDuration ---
describe("formatEntryDuration", () => {
  it("formats zero as 0:00", () => {
    expect(formatEntryDuration(0)).toBe("0:00");
  });
  it("formats sub-minute", () => {
    expect(formatEntryDuration(45)).toBe("0:45");
  });
  it("formats minutes and seconds", () => {
    expect(formatEntryDuration(125)).toBe("2:05");
  });
  it("formats with hours", () => {
    expect(formatEntryDuration(3661)).toBe("1:01:01");
  });
  it("formats large hours", () => {
    expect(formatEntryDuration(36000)).toBe("10:00:00");
  });
});

// --- parseDbDate ---
describe("parseDbDate", () => {
  it("parses ISO format with T", () => {
    const date = parseDbDate("2024-01-15T10:30:00Z");
    expect(date.getUTCHours()).toBe(10);
    expect(date.getUTCMinutes()).toBe(30);
  });
  it("parses space-separated DB format", () => {
    const date = parseDbDate("2024-01-15 10:30:00");
    expect(date.getUTCHours()).toBe(10);
    expect(date.getUTCMinutes()).toBe(30);
  });
  it("parses date correctly", () => {
    const date = parseDbDate("2024-06-20 14:00:00");
    expect(date.getUTCFullYear()).toBe(2024);
    expect(date.getUTCMonth()).toBe(5); // June is 5 (0-indexed)
    expect(date.getUTCDate()).toBe(20);
  });
});

// --- getDateKey ---
describe("getDateKey", () => {
  it("extracts date from ISO format", () => {
    expect(getDateKey("2024-01-15T10:30:00Z")).toBe("2024-01-15");
  });
  it("extracts date from space-separated format", () => {
    expect(getDateKey("2024-01-15 10:30:00")).toBe("2024-01-15");
  });
});

// --- formatDisplayDate ---
describe("formatDisplayDate", () => {
  const ref = new Date(2024, 5, 15); // June 15, 2024 (Saturday)

  it("returns Today for today's date", () => {
    expect(formatDisplayDate("2024-06-15", ref)).toBe("Today");
  });
  it("returns Yesterday for yesterday", () => {
    expect(formatDisplayDate("2024-06-14", ref)).toBe("Yesterday");
  });
  it("returns weekday + formatted date for older dates", () => {
    const result = formatDisplayDate("2024-06-10", ref);
    expect(result).toBe("Monday, 10.06.2024");
  });
  it("handles year boundary", () => {
    const jan1 = new Date(2024, 0, 1);
    expect(formatDisplayDate("2023-12-31", jan1)).toBe("Yesterday");
  });
});

// --- formatDurationShort ---
describe("formatDurationShort", () => {
  it("formats zero as 0m", () => {
    expect(formatDurationShort(0)).toBe("0m");
  });
  it("formats sub-hour", () => {
    expect(formatDurationShort(300)).toBe("5m");
  });
  it("formats exactly one hour", () => {
    expect(formatDurationShort(3600)).toBe("1h 0m");
  });
  it("formats hours and minutes", () => {
    expect(formatDurationShort(5400)).toBe("1h 30m");
  });
});

// --- formatHours ---
describe("formatHours", () => {
  it("formats zero", () => {
    expect(formatHours(0)).toBe("0.0h");
  });
  it("formats one hour", () => {
    expect(formatHours(3600)).toBe("1.0h");
  });
  it("formats fractional hours", () => {
    expect(formatHours(5400)).toBe("1.5h");
  });
  it("formats large values", () => {
    expect(formatHours(36000)).toBe("10.0h");
  });
});

// --- toLocalDateString ---
describe("toLocalDateString", () => {
  it("formats a date as YYYY-MM-DD", () => {
    const date = new Date(2024, 0, 5); // Jan 5
    expect(toLocalDateString(date)).toBe("2024-01-05");
  });
  it("pads month and day", () => {
    const date = new Date(2024, 2, 3); // Mar 3
    expect(toLocalDateString(date)).toBe("2024-03-03");
  });
  it("handles December", () => {
    const date = new Date(2024, 11, 25); // Dec 25
    expect(toLocalDateString(date)).toBe("2024-12-25");
  });
});

// --- getMondayDateString ---
describe("getMondayDateString", () => {
  it("returns Monday for a Monday", () => {
    const mon = new Date(2024, 5, 10); // June 10, 2024 = Monday
    expect(getMondayDateString(mon)).toBe("2024-06-10");
  });
  it("returns Monday for a Wednesday", () => {
    const wed = new Date(2024, 5, 12); // June 12, 2024 = Wednesday
    expect(getMondayDateString(wed)).toBe("2024-06-10");
  });
  it("returns Monday for a Sunday", () => {
    const sun = new Date(2024, 5, 16); // June 16, 2024 = Sunday
    expect(getMondayDateString(sun)).toBe("2024-06-10");
  });
  it("handles week crossing month boundary", () => {
    const fri = new Date(2024, 5, 7); // June 7, 2024 = Friday
    expect(getMondayDateString(fri)).toBe("2024-06-03");
  });
  it("handles Saturday", () => {
    const sat = new Date(2024, 5, 15); // June 15, 2024 = Saturday
    expect(getMondayDateString(sat)).toBe("2024-06-10");
  });
});

// --- getWeekRange ---
describe("getWeekRange", () => {
  it("returns Monday to Sunday", () => {
    const date = new Date(2024, 5, 12); // Wed Jun 12
    const { start, end } = getWeekRange(date);
    expect(start.getDate()).toBe(10); // Monday
    expect(end.getDate()).toBe(16); // Sunday
  });
  it("handles Sunday input", () => {
    const date = new Date(2024, 5, 16); // Sun Jun 16
    const { start, end } = getWeekRange(date);
    expect(start.getDate()).toBe(10); // Monday
    expect(end.getDate()).toBe(16); // Sunday
  });
  it("start is at midnight", () => {
    const date = new Date(2024, 5, 12);
    const { start } = getWeekRange(date);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });
  it("end is at 23:59:59", () => {
    const date = new Date(2024, 5, 12);
    const { end } = getWeekRange(date);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
  it("label includes year", () => {
    const date = new Date(2024, 5, 12);
    const { label } = getWeekRange(date);
    expect(label).toContain("2024");
  });
});

// --- getMonthRange ---
describe("getMonthRange", () => {
  it("returns first and last day of month", () => {
    const date = new Date(2024, 5, 15); // Jun 15
    const { start, end } = getMonthRange(date);
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(30); // June has 30 days
  });
  it("handles February in leap year", () => {
    const date = new Date(2024, 1, 10); // Feb 10, 2024 (leap year)
    const { end } = getMonthRange(date);
    expect(end.getDate()).toBe(29);
  });
  it("handles February in non-leap year", () => {
    const date = new Date(2023, 1, 10);
    const { end } = getMonthRange(date);
    expect(end.getDate()).toBe(28);
  });
  it("label includes month name and year", () => {
    const date = new Date(2024, 5, 15);
    const { label } = getMonthRange(date);
    expect(label).toContain("June");
    expect(label).toContain("2024");
  });
});

// --- toLocalDateTimeInput / fromLocalDateTimeInput round-trip ---
describe("toLocalDateTimeInput / fromLocalDateTimeInput", () => {
  it("round-trips correctly for a UTC date", () => {
    const dbDate = "2024-06-15 10:30:00";
    const localInput = toLocalDateTimeInput(dbDate);
    const backToDb = fromLocalDateTimeInput(localInput);
    // Should match the original (ignoring timezone offset effects)
    const original = parseDbDate(dbDate);
    const roundTripped = parseDbDate(backToDb);
    expect(Math.abs(original.getTime() - roundTripped.getTime())).toBeLessThan(1000);
  });
  it("toLocalDateTimeInput produces valid format", () => {
    const result = toLocalDateTimeInput("2024-06-15 10:30:00");
    // Should be YYYY-MM-DDTHH:MM format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
  it("fromLocalDateTimeInput produces space-separated format", () => {
    const result = fromLocalDateTimeInput("2024-06-15T10:30");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

// --- groupEntriesByDay ---
describe("groupEntriesByDay", () => {
  const makeEntry = (
    id: number,
    projectId: number,
    startTime: string,
    duration: number,
    name = "Project",
    color = "#3B82F6"
  ): EntryWithProject => ({
    id,
    project_id: projectId,
    start_time: startTime,
    end_time: startTime, // simplified
    duration,
    created_at: startTime,
    project_name: name,
    project_color: color,
  });

  const today = new Date(2024, 5, 15);

  it("returns empty array for no entries", () => {
    expect(groupEntriesByDay([], today)).toEqual([]);
  });

  it("groups entries by day", () => {
    const entries = [
      makeEntry(1, 1, "2024-06-15 10:00:00", 3600),
      makeEntry(2, 1, "2024-06-15 14:00:00", 1800),
      makeEntry(3, 1, "2024-06-14 09:00:00", 7200),
    ];
    const groups = groupEntriesByDay(entries, today);
    expect(groups).toHaveLength(2);
  });

  it("sorts groups by date descending", () => {
    const entries = [
      makeEntry(1, 1, "2024-06-13 10:00:00", 3600),
      makeEntry(2, 1, "2024-06-15 14:00:00", 1800),
      makeEntry(3, 1, "2024-06-14 09:00:00", 7200),
    ];
    const groups = groupEntriesByDay(entries, today);
    expect(groups[0].date).toBe("2024-06-15");
    expect(groups[1].date).toBe("2024-06-14");
    expect(groups[2].date).toBe("2024-06-13");
  });

  it("computes total duration per day", () => {
    const entries = [
      makeEntry(1, 1, "2024-06-15 10:00:00", 3600),
      makeEntry(2, 1, "2024-06-15 14:00:00", 1800),
    ];
    const groups = groupEntriesByDay(entries, today);
    expect(groups[0].totalDuration).toBe(5400);
  });

  it("computes project breakdown with percentages", () => {
    const entries = [
      makeEntry(1, 1, "2024-06-15 10:00:00", 3600, "Work", "#3B82F6"),
      makeEntry(2, 2, "2024-06-15 14:00:00", 1200, "Personal", "#22C55E"),
    ];
    const groups = groupEntriesByDay(entries, today);
    const breakdown = groups[0].projectBreakdown;
    expect(breakdown).toHaveLength(2);
    // Work has 3600 out of 4800 total = 75%
    const work = breakdown.find((p) => p.projectName === "Work")!;
    expect(work.percentage).toBeCloseTo(75);
    // Personal has 1200 out of 4800 = 25%
    const personal = breakdown.find((p) => p.projectName === "Personal")!;
    expect(personal.percentage).toBeCloseTo(25);
  });

  it("breakdown is sorted by totalSeconds descending", () => {
    const entries = [
      makeEntry(1, 1, "2024-06-15 10:00:00", 1200, "Small"),
      makeEntry(2, 2, "2024-06-15 14:00:00", 3600, "Large"),
    ];
    const groups = groupEntriesByDay(entries, today);
    expect(groups[0].projectBreakdown[0].projectName).toBe("Large");
  });

  it("sets displayDate correctly for today", () => {
    const entries = [makeEntry(1, 1, "2024-06-15 10:00:00", 3600)];
    const groups = groupEntriesByDay(entries, today);
    expect(groups[0].displayDate).toBe("Today");
  });

  it("handles entries with null duration", () => {
    const entry = makeEntry(1, 1, "2024-06-15 10:00:00", 0);
    entry.duration = null;
    const groups = groupEntriesByDay([entry], today);
    expect(groups[0].totalDuration).toBe(0);
  });
});

// --- formatTimeOfDay ---
describe("formatTimeOfDay", () => {
  it("returns a time string", () => {
    const result = formatTimeOfDay("2024-06-15 10:30:00");
    // The result depends on locale, but should contain digits
    expect(result).toMatch(/\d/);
  });
});
