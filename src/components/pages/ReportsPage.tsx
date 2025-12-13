import { useEffect, useState } from "react";
import { getDb, Project } from "../../lib/db";

interface ProjectStats {
  project_id: number;
  project_name: string;
  project_color: string;
  total_duration: number;
}

interface DailyStats {
  date: string;
  displayDate: string;
  total: number;
  byProject: ProjectStats[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  return hours.toFixed(1) + "h";
}

export default function ReportsPage() {
  const [todayTotal, setTodayTotal] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
  const [projectTotals, setProjectTotals] = useState<ProjectStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const db = await getDb();

      // Today's total
      const today = await db.select<{ total: number | null }[]>(
        `SELECT SUM(duration) as total FROM time_entries
         WHERE date(start_time) = date('now') AND end_time IS NOT NULL`
      );
      setTodayTotal(today[0]?.total || 0);

      // This week's total
      const week = await db.select<{ total: number | null }[]>(
        `SELECT SUM(duration) as total FROM time_entries
         WHERE start_time >= datetime('now', 'weekday 0', '-7 days') AND end_time IS NOT NULL`
      );
      setWeekTotal(week[0]?.total || 0);

      // This month's total
      const month = await db.select<{ total: number | null }[]>(
        `SELECT SUM(duration) as total FROM time_entries
         WHERE start_time >= datetime('now', 'start of month') AND end_time IS NOT NULL`
      );
      setMonthTotal(month[0]?.total || 0);

      // Last 7 days breakdown
      const daily = await db.select<{ date: string; total: number }[]>(
        `SELECT date(start_time) as date, SUM(duration) as total
         FROM time_entries
         WHERE start_time >= datetime('now', '-7 days') AND end_time IS NOT NULL
         GROUP BY date(start_time)
         ORDER BY date DESC`
      );

      const dailyStats: DailyStats[] = [];
      for (const day of daily) {
        const byProject = await db.select<ProjectStats[]>(
          `SELECT te.project_id, p.name as project_name, p.color as project_color,
                  SUM(te.duration) as total_duration
           FROM time_entries te
           JOIN projects p ON te.project_id = p.id
           WHERE date(te.start_time) = ? AND te.end_time IS NOT NULL
           GROUP BY te.project_id
           ORDER BY total_duration DESC`,
          [day.date]
        );

        const [year, monthNum, dayNum] = day.date.split("-").map(Number);
        const dateObj = new Date(year, monthNum - 1, dayNum);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        let displayDate: string;
        if (dateObj.getTime() === todayDate.getTime()) {
          displayDate = "Today";
        } else {
          displayDate = dateObj.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
        }

        dailyStats.push({
          date: day.date,
          displayDate,
          total: day.total,
          byProject,
        });
      }
      setWeeklyStats(dailyStats);

      // Project totals (all time)
      const projects = await db.select<ProjectStats[]>(
        `SELECT te.project_id, p.name as project_name, p.color as project_color,
                SUM(te.duration) as total_duration
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         WHERE te.end_time IS NOT NULL
         GROUP BY te.project_id
         ORDER BY total_duration DESC`
      );
      setProjectTotals(projects);
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  const maxDailyTotal = Math.max(...weeklyStats.map((d) => d.total), 1);

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-gray-400 text-sm mt-1">Track your productivity over time</p>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#252525] rounded-xl p-5">
          <div className="text-sm text-gray-400 mb-1">Today</div>
          <div className="text-2xl font-semibold">{formatHours(todayTotal)}</div>
        </div>
        <div className="bg-[#252525] rounded-xl p-5">
          <div className="text-sm text-gray-400 mb-1">This Week</div>
          <div className="text-2xl font-semibold">{formatHours(weekTotal)}</div>
        </div>
        <div className="bg-[#252525] rounded-xl p-5">
          <div className="text-sm text-gray-400 mb-1">This Month</div>
          <div className="text-2xl font-semibold">{formatHours(monthTotal)}</div>
        </div>
      </div>

      {/* Daily breakdown */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-4">Last 7 Days</h2>
        <div className="bg-[#252525] rounded-xl p-5">
          {weeklyStats.length === 0 ? (
            <div className="text-gray-400 text-center py-4">No data for the last 7 days</div>
          ) : (
            <div className="space-y-4">
              {weeklyStats.map((day) => (
                <div key={day.date}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-300">{day.displayDate}</span>
                    <span className="text-sm font-medium">{formatDuration(day.total)}</span>
                  </div>
                  <div className="h-6 bg-[#1a1a1a] rounded-full overflow-hidden flex">
                    {day.byProject.map((proj) => (
                      <div
                        key={proj.project_id}
                        className="h-full"
                        style={{
                          backgroundColor: proj.project_color,
                          width: `${(proj.total_duration / maxDailyTotal) * 100}%`,
                        }}
                        title={`${proj.project_name}: ${formatDuration(proj.total_duration)}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project breakdown */}
      <div>
        <h2 className="text-lg font-medium mb-4">By Project</h2>
        <div className="bg-[#252525] rounded-xl overflow-hidden">
          {projectTotals.length === 0 ? (
            <div className="text-gray-400 text-center py-8">No tracked time yet</div>
          ) : (
            projectTotals.map((proj, index) => (
              <div
                key={proj.project_id}
                className={`flex items-center gap-4 px-5 py-4 ${
                  index !== projectTotals.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: proj.project_color }}
                />
                <span className="flex-1 font-medium">{proj.project_name}</span>
                <span className="text-gray-400">{formatDuration(proj.total_duration)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
