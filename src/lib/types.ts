import { TimeEntry } from "./db";

export interface EntryWithProject extends TimeEntry {
  project_name: string;
  project_color: string;
}

export interface ProjectSummary {
  projectId: number;
  projectName: string;
  projectColor: string;
  totalSeconds: number;
  percentage: number;
}

export interface DayGroup {
  date: string;
  displayDate: string;
  entries: EntryWithProject[];
  totalDuration: number;
  projectBreakdown: ProjectSummary[];
}
