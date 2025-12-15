import { useEffect, useState } from "react";
import { getDb } from "../../lib/db";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProjectInfo {
  id: number;
  name: string;
  color: string;
}

interface ProjectStats {
  project_id: number;
  project_name: string;
  project_color: string;
  total_duration: number;
}

interface DailyChartData {
  date: string;
  displayDate: string;
  [key: string]: number | string; // project hours by name
}

type ViewMode = "week" | "month";

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

function getWeekRange(date: Date): { start: Date; end: Date; label: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const label = `${startStr} - ${endStr}, ${start.getFullYear()}`;

  return { start, end, label };
}

function getMonthRange(date: Date): { start: Date; end: Date; label: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { start, end, label };
}

function toLocalDateString(date: Date): string {
  // Format as YYYY-MM-DD in local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ReportsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [chartData, setChartData] = useState<DailyChartData[]>([]);
  const [periodStats, setPeriodStats] = useState<ProjectStats[]>([]);
  const [periodTotal, setPeriodTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const range = viewMode === "week" ? getWeekRange(currentDate) : getMonthRange(currentDate);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      loadStats();
    }
  }, [projects, viewMode, currentDate]);

  async function loadProjects() {
    const db = await getDb();
    const result = await db.select<ProjectInfo[]>("SELECT id, name, color FROM projects ORDER BY name");
    setProjects(result);
  }

  async function loadStats() {
    setIsLoading(true);
    try {
      const db = await getDb();
      const startDate = toLocalDateString(range.start);
      const endDate = toLocalDateString(range.end);

      // Get daily breakdown for chart
      // Use 'localtime' modifier to convert UTC timestamps to local timezone for grouping
      const dailyRaw = await db.select<{ date: string; project_id: number; project_name: string; total: number }[]>(
        `SELECT date(start_time, 'localtime') as date, te.project_id, p.name as project_name, SUM(te.duration) as total
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         WHERE date(te.start_time, 'localtime') >= ? AND date(te.start_time, 'localtime') <= ? AND te.end_time IS NOT NULL
         GROUP BY date(te.start_time, 'localtime'), te.project_id
         ORDER BY date(te.start_time, 'localtime')`,
        [startDate, endDate]
      );

      // Build chart data with all days in range
      const chartMap = new Map<string, DailyChartData>();
      const current = new Date(range.start);
      while (current <= range.end) {
        const dateStr = toLocalDateString(current);
        const dayLabel = current.toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
        });
        const entry: DailyChartData = { date: dateStr, displayDate: dayLabel };
        // Initialize all projects to 0
        for (const p of projects) {
          entry[p.name] = 0;
        }
        chartMap.set(dateStr, entry);
        current.setDate(current.getDate() + 1);
      }

      // Fill in actual data
      for (const row of dailyRaw) {
        const entry = chartMap.get(row.date);
        if (entry) {
          entry[row.project_name] = row.total / 3600; // Convert to hours
        }
      }

      setChartData(Array.from(chartMap.values()));

      // Get period totals by project
      const periodRaw = await db.select<ProjectStats[]>(
        `SELECT te.project_id, p.name as project_name, p.color as project_color,
                SUM(te.duration) as total_duration
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         WHERE date(te.start_time, 'localtime') >= ? AND date(te.start_time, 'localtime') <= ? AND te.end_time IS NOT NULL
         GROUP BY te.project_id
         ORDER BY total_duration DESC`,
        [startDate, endDate]
      );
      setPeriodStats(periodRaw);

      // Calculate total
      const total = periodRaw.reduce((sum, p) => sum + p.total_duration, 0);
      setPeriodTotal(total);
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function navigate(direction: -1 | 1) {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  const isCurrentPeriod = viewMode === "week"
    ? getWeekRange(new Date()).label === range.label
    : getMonthRange(new Date()).label === range.label;

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-gray-400 text-sm mt-1">Track your productivity over time</p>
      </header>

      {/* View mode toggle and navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("week")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === "week"
                ? "bg-[#5BA4C4] text-white"
                : "bg-[#252525] text-gray-300 hover:bg-[#303030]"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === "month"
                ? "bg-[#5BA4C4] text-white"
                : "bg-[#252525] text-gray-300 hover:bg-[#303030]"
            }`}
          >
            Month
          </button>
        </div>

        <div className="flex items-center gap-3">
          {!isCurrentPeriod && (
            <button
              onClick={goToToday}
              className="px-3 py-1.5 rounded-lg text-sm bg-[#252525] text-gray-300 hover:bg-[#303030] transition-colors"
            >
              Today
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg bg-[#252525] text-gray-300 hover:bg-[#303030] transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium min-w-[180px] text-center">{range.label}</span>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-lg bg-[#252525] text-gray-300 hover:bg-[#303030] transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-[#252525] rounded-xl p-5 mb-6">
        <div className="text-sm text-gray-400 mb-1">
          Total {viewMode === "week" ? "this week" : "this month"}
        </div>
        <div className="text-3xl font-semibold">{formatHours(periodTotal)}</div>
      </div>

      {/* Stacked bar chart */}
      <div className="bg-[#252525] rounded-xl p-5 mb-6">
        <h2 className="text-lg font-medium mb-4">Daily Breakdown</h2>
        {chartData.length === 0 || periodTotal === 0 ? (
          <div className="text-gray-400 text-center py-12">No data for this period</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "#374151" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "#374151" }}
                  tickLine={false}
                  tickFormatter={(value) => `${value}h`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  labelStyle={{ color: "#fff", marginBottom: "4px" }}
                  itemStyle={{ padding: "2px 0" }}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}h`, name]}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "16px" }}
                  formatter={(value) => <span style={{ color: "#d1d5db", fontSize: "13px" }}>{value}</span>}
                />
                {projects.map((project) => (
                  <Bar
                    key={project.id}
                    dataKey={project.name}
                    stackId="a"
                    fill={project.color}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Project breakdown for period */}
      <div className="bg-[#252525] rounded-xl overflow-hidden">
        <h2 className="text-lg font-medium px-5 pt-5 pb-3">By Project</h2>
        {periodStats.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No tracked time for this period</div>
        ) : (
          periodStats.map((proj, index) => {
            const percentage = periodTotal > 0 ? (proj.total_duration / periodTotal) * 100 : 0;
            return (
              <div
                key={proj.project_id}
                className={`px-5 py-4 ${
                  index !== periodStats.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: proj.project_color }}
                  />
                  <span className="flex-1 font-medium">{proj.project_name}</span>
                  <span className="text-gray-400 text-sm">{percentage.toFixed(0)}%</span>
                  <span className="font-medium w-20 text-right">{formatDuration(proj.total_duration)}</span>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden ml-6">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      backgroundColor: proj.project_color,
                      width: `${percentage}%`,
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
