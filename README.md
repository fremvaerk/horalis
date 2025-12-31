# Horalis

A minimal, elegant time tracker with a floating window for macOS, Windows, and Linux.

*Horalis* — from Latin "of the hours"

---

## Features

- **Floating Timer Window** — Always-on-top compact timer that stays visible while you work
- **Project & Task Tracking** — Organize time entries by projects and tasks
- **Daily Overview** — See your daily totals at a glance
- **History & Reports** — Browse past entries and analyze your time
- **Idle Detection** — Automatically detects when you're away
- **Break Reminders** — Configurable notifications to remind you to take breaks
- **Native Performance** — Built with Tauri for a fast, lightweight experience
- **Cross-Platform** — Works on macOS, Windows, and Linux

## Screenshots

| Floating Timer | Dashboard |
|----------------|-----------|
| ![Floating Timer](screenshots/floating-timer.png) | ![Dashboard](screenshots/dashboard.png) |

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/yourusername/horalis/releases) page.

- **macOS**: `Horalis_x.x.x_aarch64.dmg` (Apple Silicon) or `Horalis_x.x.x_x64.dmg` (Intel)
- **Windows**: `Horalis_x.x.x_x64-setup.exe`
- **Linux**: `Horalis_x.x.x_amd64.deb` or `Horalis_x.x.x_amd64.AppImage`

### Build from Source

Prerequisites:
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/)
- [pnpm](https://pnpm.io/)

```bash
# Clone the repository
git clone https://github.com/yourusername/horalis.git
cd horalis

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Rust, Tauri 2.0
- **Database**: SQLite
- **Icons**: Lucide React

## Usage

1. **Start the app** — The floating timer window appears
2. **Enter a task** — Type what you're working on
3. **Select a project** — Choose or create a project
4. **Click Start** — Begin tracking your time
5. **Open Dashboard** — Right-click the timer or use the menu to view history and reports

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Start/Stop Timer | `Space` (when focused) |
| Open Dashboard | `Cmd/Ctrl + D` |
| Settings | `Cmd/Ctrl + ,` |

## Configuration

Settings are accessible from the Dashboard → Settings page:

- **Break Reminders** — Set intervals for break notifications
- **Idle Timeout** — Configure when to pause tracking on inactivity
- **Appearance** — Customize the floating window

## Data Storage

Your data is stored locally:

- **macOS**: `~/Library/Application Support/com.horalis.app/horalis.db`
- **Windows**: `%APPDATA%/com.horalis.app/horalis.db`
- **Linux**: `~/.local/share/com.horalis.app/horalis.db`

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with Tauri and React
