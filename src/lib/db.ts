import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:timetracker.db");
    await initSchema();
  }
  return db;
}

async function initSchema() {
  if (!db) return;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // Insert default projects if none exist
  const projects = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM projects"
  );
  if (projects[0].count === 0) {
    await db.execute("INSERT INTO projects (name, color) VALUES (?, ?)", ["Work", "#3B82F6"]);
    await db.execute("INSERT INTO projects (name, color) VALUES (?, ?)", ["Personal", "#22C55E"]);
    await db.execute("INSERT INTO projects (name, color) VALUES (?, ?)", ["Learning", "#F59E0B"]);
    await db.execute("INSERT INTO projects (name, color) VALUES (?, ?)", ["Health", "#EC4899"]);
    await db.execute("INSERT INTO projects (name, color) VALUES (?, ?)", ["Side Project", "#8B5CF6"]);
  }
}

export interface Project {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface TimeEntry {
  id: number;
  project_id: number;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  created_at: string;
}

export async function getProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.select<Project[]>("SELECT * FROM projects ORDER BY name");
}

export async function createProject(name: string, color: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO projects (name, color) VALUES (?, ?)",
    [name, color]
  );
  return result.lastInsertId ?? 0;
}

export async function updateProject(id: number, name: string, color: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE projects SET name = ?, color = ? WHERE id = ?",
    [name, color, id]
  );
}

export async function deleteProject(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM time_entries WHERE project_id = ?", [id]);
  await db.execute("DELETE FROM projects WHERE id = ?", [id]);
}

export async function startTimeEntry(projectId: number): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO time_entries (project_id, start_time) VALUES (?, datetime('now'))",
    [projectId]
  );
  return result.lastInsertId ?? 0;
}

export async function stopTimeEntry(entryId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE time_entries
     SET end_time = datetime('now'),
         duration = CAST((julianday(datetime('now')) - julianday(start_time)) * 86400 AS INTEGER)
     WHERE id = ?`,
    [entryId]
  );
}

export async function getRunningEntry(): Promise<(TimeEntry & { project_name: string; project_color: string }) | null> {
  const db = await getDb();
  const entries = await db.select<(TimeEntry & { project_name: string; project_color: string })[]>(
    `SELECT te.*, p.name as project_name, p.color as project_color
     FROM time_entries te
     JOIN projects p ON te.project_id = p.id
     WHERE te.end_time IS NULL
     LIMIT 1`
  );
  return entries[0] || null;
}

export async function getTimeEntries(limit = 50): Promise<(TimeEntry & { project_name: string; project_color: string })[]> {
  const db = await getDb();
  return db.select<(TimeEntry & { project_name: string; project_color: string })[]>(
    `SELECT te.*, p.name as project_name, p.color as project_color
     FROM time_entries te
     JOIN projects p ON te.project_id = p.id
     WHERE te.end_time IS NOT NULL
     ORDER BY te.start_time DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getTodayTotal(): Promise<number> {
  const db = await getDb();
  const result = await db.select<{ total: number | null }[]>(
    `SELECT SUM(duration) as total
     FROM time_entries
     WHERE date(start_time, 'localtime') = date('now', 'localtime') AND end_time IS NOT NULL`
  );
  return result[0]?.total || 0;
}

export async function getWeekTotal(): Promise<number> {
  const db = await getDb();
  const result = await db.select<{ total: number | null }[]>(
    `SELECT SUM(duration) as total
     FROM time_entries
     WHERE date(start_time, 'localtime') >= date('now', 'localtime', '-7 days') AND end_time IS NOT NULL`
  );
  return result[0]?.total || 0;
}

export async function getLastUsedProjectId(): Promise<number | null> {
  const db = await getDb();
  const result = await db.select<{ project_id: number }[]>(
    `SELECT project_id FROM time_entries ORDER BY start_time DESC LIMIT 1`
  );
  return result[0]?.project_id || null;
}

export async function deleteTimeEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM time_entries WHERE id = ?", [id]);
}

export async function updateTimeEntry(
  id: number,
  projectId: number,
  startTime: string,
  endTime: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE time_entries
     SET project_id = ?,
         start_time = ?,
         end_time = ?,
         duration = CAST((julianday(?) - julianday(?)) * 86400 AS INTEGER)
     WHERE id = ?`,
    [projectId, startTime, endTime, endTime, startTime, id]
  );
}
