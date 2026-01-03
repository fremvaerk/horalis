# Horalis - Project Context for Claude

## Overview

**Horalis** (Latin: "of the hours") is a minimal, elegant time tracker with a floating window for macOS, Windows, and Linux. Built with Tauri 2.0, it's designed for solo developers who want to track time spent on different projects without complexity.

**Status**: Work in Progress

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling
- **Zustand** for state management
- **React Router DOM** for routing
- **Recharts** for charts/reports
- **Lucide React** for icons
- **Vite 7** as build tool

### Backend
- **Rust** with **Tauri 2.0**
- **SQLite** via `tauri-plugin-sql`
- Key Tauri plugins:
  - `tauri-plugin-positioner` - window positioning
  - `tauri-plugin-global-shortcut` - keyboard shortcuts
  - `tauri-plugin-notification` - system notifications
- `system-idle-time` crate for idle detection
- `ab_glyph` for rendering letters on tray icons

## Project Structure

```
timetracker/
├── src/                          # Frontend source
│   ├── App.tsx                   # Main app with routing
│   ├── main.tsx                  # Entry point
│   ├── components/
│   │   ├── FloatingTimer.tsx     # Main floating timer window (240x44px)
│   │   ├── Dashboard.tsx         # Dashboard layout with sidebar
│   │   ├── HistoryView.tsx       # History component
│   │   └── pages/
│   │       ├── HistoryPage.tsx   # History page
│   │       ├── SettingsPage.tsx  # Settings with Projects/General/Reminders tabs
│   │       └── ReportsPage.tsx   # Reports with charts
│   ├── lib/
│   │   └── db.ts                 # Database operations & schema
│   └── store/
│       └── index.ts              # Zustand store
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   └── lib.rs                # Main Rust code (tray, timer, reminders)
│   ├── icons/                    # App icons (all sizes)
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── .github/
│   └── workflows/
│       ├── build.yml             # Release builds (on tag push)
│       └── ci.yml                # CI checks (on PR/push to main)
└── README.md                     # Project documentation
```

## Database Schema (SQLite)

Located at:
- **macOS**: `~/Library/Application Support/com.horalis.app/horalis.db`
- **Windows**: `%APPDATA%/com.horalis.app/horalis.db`
- **Linux**: `~/.local/share/com.horalis.app/horalis.db`

### Tables

```sql
-- Projects (categories for time tracking)
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Time entries (tracked time periods)
CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME,           -- NULL when timer is running
  duration INTEGER,            -- Calculated in seconds when stopped
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- App settings (key-value pairs)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### Settings Keys
- `show_window_on_startup` - Show floating timer on app start
- `show_timer_in_tray` - Show elapsed time next to tray icon (macOS only)
- `stop_timer_when_idle` - Auto-stop on idle
- `idle_timeout_minutes` - Idle threshold
- `reminder_enabled` - Enable tracking reminders
- `reminder_interval_minutes` - Reminder frequency
- `reminder_start_time` - Reminder window start (HH:MM)
- `reminder_end_time` - Reminder window end (HH:MM)
- `reminder_weekdays` - Active days (comma-separated: 0=Sun, 1=Mon, etc.)

## Key Features

### Windows
1. **Floating Timer** (`main` window) - 240x44px, always-on-top, transparent, no decorations
2. **Dashboard** (`dashboard` window) - 900x650px, normal window with sidebar navigation

### Tray Icon
- Colored circle (22x22px) showing project's first letter when timer is running
- Gray circle when stopped
- Shows elapsed time as title (macOS only, format: "H:MM")
- Menu with: Show/Hide Timer, Dashboard, Stop Timer, project list (with colored icons), Quit
- Tooltip shows "Horalis"

### Timer Features
- Native background timer (Rust) that survives frontend reloads
- Updates tray title every minute
- Idle detection with configurable timeout
- System sleep detection (stops timer automatically)
- Auto-stops running entries on app quit

### Reminders
- Background reminder system in Rust
- Configurable interval, time window, and weekdays
- Only triggers when timer is NOT running
- Shows system notification

## Development Commands

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build

# Type check only
pnpm tsc --noEmit

# Build frontend only
pnpm build
```

## GitHub Actions

### CI (`.github/workflows/ci.yml`)
- Triggers on: push to main, PRs to main
- Runs on: macOS, Ubuntu, Windows
- Steps: type check, frontend build, Rust check

### Build & Release (`.github/workflows/build.yml`)
- Triggers on: version tags (`v*`), manual dispatch
- Builds for: macOS (arm64, x64, universal), Windows, Linux
- Creates draft release with artifacts

## App Configuration

**Bundle Identifier**: `com.horalis.app`
**macOS Minimum Version**: 10.15
**macOS Private API**: Enabled (for tray title)

## Important Implementation Details

### Tray Icon Generation (`lib.rs`)
- Icons are generated at runtime as RGBA pixel data
- Uses `ab_glyph` to render project's first letter on the circle
- `generate_colored_icon()` - 22x22 for tray icon
- `generate_menu_icon()` - 16x16 for menu items

### Timer State
- Start time stored as Unix timestamp (milliseconds)
- Background task updates tray every 10 seconds, but only changes title when minute changes
- Emits events: `idle-timeout`, `system-sleep`, `stop-timer`, `start-project-timer`

### Frontend-Backend Communication
Tauri commands:
- `start_tray_timer` - Start native timer with idle options
- `stop_tray_timer` - Stop native timer
- `set_tray_title` / `clear_tray_title` - Manual tray title control
- `set_tray_icon_color` / `reset_tray_icon` - Change tray icon
- `update_tray_menu` - Rebuild tray menu with projects
- `start_reminder` / `stop_reminder` - Control reminder system

## Recent Changes (Session Context)

1. **Renamed app** from "TimeTracker" to "Horalis"
2. **Custom app icon** - Teal/cyan colored icon (#60C5D8) from external EPS
3. **Custom color picker** for projects in Settings (added pipette icon button)
4. **Tray tooltip** added - Shows "Horalis" on hover
5. **README** created with full documentation
6. **GitHub Actions** set up for CI and releases

## Pending/Future Work

- Add screenshots to README (folder doesn't exist yet)
- Add LICENSE file
- Testing
- Potential features: task descriptions, export functionality, pomodoro mode

## Preset Colors

```javascript
const PRESET_COLORS = [
  "#3B82F6", // blue
  "#22C55E", // green
  "#F59E0B", // amber
  "#EC4899", // pink
  "#8B5CF6", // purple
  "#EF4444", // red
  "#14B8A6", // teal
  "#F97316", // orange
];
```

## Troubleshooting

### Database Migration
If migrating from old app (TimeTracker):
```bash
cp ~/Library/Application\ Support/com.timetracker.app/timetracker.db \
   ~/Library/Application\ Support/com.horalis.app/horalis.db
```

### Build Issues
- Ensure Rust, Node.js 18+, and pnpm are installed
- On Linux: `sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`

### Tray Title Not Showing
- Only works on macOS (platform-specific feature)
- Requires `macos-private-api` feature in Cargo.toml
