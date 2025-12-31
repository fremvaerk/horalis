# Horalis

A minimal, elegant time tracker with a floating window for macOS, Windows, and Linux.

*Horalis* — from Latin "of the hours"

> **Work in Progress** — This project is under active development. Some features may be incomplete or change.

---

## About

Horalis is a simple time tracking tool designed primarily for solo developers who want to track time spent on different projects. No complicated features, no team collaboration overhead — just a clean floating timer that stays out of your way while you work.

---

## Features

- **Floating Timer Window** — Always-on-top compact timer that stays visible while you work
- **Project Tracking** — Organize time entries by projects
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

Download the latest release for your platform from the [Releases](https://github.com/fremvaerk/horalis/releases) page.

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
git clone https://github.com/fremvaerk/horalis.git
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
2. **Open Dashboard** — Click the menu icon to open the dashboard
3. **Create projects** — Go to Settings and add your projects
4. **Select a project** — Back in the floating timer, choose a project
5. **Click Start** — Begin tracking your time

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
