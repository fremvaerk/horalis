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
import { ChevronLeft, ChevronRight, BarChart3, TrendingUp } from "lucide-react";
import {
  formatDurationShort,
  formatHours,
  getWeekRange,
  getMonthRange,
  toLocalDateString,
} from "../../lib/format";

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
  [key: string]: number | string;
}

type ViewMode = "week" | "month";

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

      const dailyRaw = await db.select<{ date: string; project_id: number; project_name: string; total: number }[]>(
        `SELECT date(start_time, 'localtime') as date, te.project_id, p.name as project_name, SUM(te.duration) as total
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         WHERE date(te.start_time, 'localtime') >= ? AND date(te.start_time, 'localtime') <= ? AND te.end_time IS NOT NULL
         GROUP BY date(te.start_time, 'localtime'), te.project_id
         ORDER BY date(te.start_time, 'localtime')`,
        [startDate, endDate]
      );

      const chartMap = new Map<string, DailyChartData>();
      const current = new Date(range.start);
      while (current <= range.end) {
        const dateStr = toLocalDateString(current);
        const dayLabel = current.toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
        });
        const entry: DailyChartData = { date: dateStr, displayDate: dayLabel };
        for (const p of projects) {
          entry[p.name] = 0;
        }
        chartMap.set(dateStr, entry);
        current.setDate(current.getDate() + 1);
      }

      for (const row of dailyRaw) {
        const entry = chartMap.get(row.date);
        if (entry) {
          entry[row.project_name] = row.total / 3600;
        }
      }

      setChartData(Array.from(chartMap.values()));

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
        <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--border-default)',
              borderTopColor: 'var(--accent-primary)'
            }}
          />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <header className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-primary-muted)' }}
          >
            <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Track your productivity over time
            </p>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div
        className="flex items-center justify-between mb-8 animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        {/* View toggle */}
        <div
          className="flex items-center p-1 rounded-xl"
          style={{ background: 'var(--bg-surface)' }}
        >
          <button
            onClick={() => setViewMode("week")}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: viewMode === "week" ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === "week" ? 'var(--bg-base)' : 'var(--text-muted)',
              boxShadow: viewMode === "week" ? 'var(--shadow-sm)' : 'none'
            }}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode("month")}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: viewMode === "month" ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === "month" ? 'var(--bg-base)' : 'var(--text-muted)',
              boxShadow: viewMode === "month" ? 'var(--shadow-sm)' : 'none'
            }}
          >
            Month
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          {!isCurrentPeriod && (
            <button
              onClick={goToToday}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-default)'}
            >
              Today
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl transition-all duration-200"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'var(--bg-card)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span
              className="text-sm font-medium min-w-[180px] text-center"
              style={{ color: 'var(--text-primary)' }}
            >
              {range.label}
            </span>
            <button
              onClick={() => navigate(1)}
              className="p-2 rounded-xl transition-all duration-200"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'var(--bg-card)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary card */}
      <div
        className="rounded-2xl p-6 mb-6 animate-fade-in-up"
        style={{
          animationDelay: '100ms',
          background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-surface) 100%)',
          border: '1px solid var(--border-accent)',
          boxShadow: 'var(--shadow-glow)'
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div
              className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Total {viewMode === "week" ? "this week" : "this month"}
            </div>
            <div
              className="text-4xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}
            >
              {formatHours(periodTotal)}
            </div>
          </div>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent-primary-muted)' }}
          >
            <TrendingUp size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div
        className="rounded-2xl p-6 mb-6 animate-fade-in-up"
        style={{
          animationDelay: '150ms',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <h2
          className="text-lg font-semibold mb-5"
          style={{ color: 'var(--text-primary)' }}
        >
          Daily Breakdown
        </h2>
        {chartData.length === 0 || periodTotal === 0 ? (
          <div
            className="text-center py-16"
            style={{ color: 'var(--text-muted)' }}
          >
            <BarChart3
              size={48}
              className="mx-auto mb-4"
              style={{ color: 'var(--text-faint)' }}
            />
            <p>No data for this period</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  tickFormatter={(value) => `${value}h`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161616',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '13px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                  labelStyle={{ color: '#fff', marginBottom: '8px', fontWeight: 500 }}
                  itemStyle={{ padding: '3px 0' }}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}h`, name]}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => (
                    <span style={{ color: '#a1a1aa', fontSize: '12px', marginLeft: '4px' }}>{value}</span>
                  )}
                />
                {projects.map((project) => (
                  <Bar
                    key={project.id}
                    dataKey={project.name}
                    stackId="a"
                    fill={project.color}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Project breakdown */}
      <div
        className="rounded-2xl overflow-hidden animate-fade-in-up"
        style={{
          animationDelay: '200ms',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <h2
          className="text-lg font-semibold px-6 pt-6 pb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          By Project
        </h2>
        {periodStats.length === 0 ? (
          <div
            className="text-center py-12"
            style={{ color: 'var(--text-muted)' }}
          >
            No tracked time for this period
          </div>
        ) : (
          periodStats.map((proj, index) => {
            const percentage = periodTotal > 0 ? (proj.total_duration / periodTotal) * 100 : 0;
            return (
              <div
                key={proj.project_id}
                className="px-6 py-4 transition-colors duration-150"
                style={{
                  borderBottom: index !== periodStats.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div className="flex items-center gap-4 mb-3">
                  <div
                    className="w-3 h-3 rounded-md shrink-0"
                    style={{ backgroundColor: proj.project_color }}
                  />
                  <span className="flex-1 font-medium">{proj.project_name}</span>
                  <span
                    className="text-xs px-2 py-1 rounded-md"
                    style={{
                      background: 'var(--bg-surface)',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {percentage.toFixed(0)}%
                  </span>
                  <span
                    className="font-medium w-24 text-right tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {formatDurationShort(proj.total_duration)}
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden ml-7"
                  style={{ background: 'var(--bg-surface)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
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
