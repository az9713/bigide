# BigIDE: Agent Orchestration IDE

> A desktop application for orchestrating AI coding agents across multiple projects — with git worktree isolation, terminals, task boards, code review, embedded browser preview, governance controls, GitHub PR/merge workflow, and auto-generated session reports built in.

### Inspiration

This project was inspired by two key ideas in the AI-assisted development space:

- **Theo Browne's video ["We need a bigger IDE"](https://www.youtube.com/watch?v=oMDnaMIpoGo)** — arguing that agentic coding demands a new kind of IDE that wraps all your projects in a spatial, zoomable workspace with embedded browsers, terminals, and agent orchestration.
- **Addy Osmani's article ["The IDE Is Being De-Centered"](https://addyosmani.com/blog/the-ide-is-being-de-centered/)** — arguing that the center of gravity is shifting from the text editor to orchestration dashboards and control planes, with task boards, worktree isolation, and governance as core primitives.

BigIDE is an attempt to combine both visions into a working prototype. For a detailed comparison of how the current implementation aligns with and diverges from these visions, see [docs/VISION_COMPARISON.md](docs/VISION_COMPARISON.md).

### Demo

https://github.com/user-attachments/assets/6be9a7a9-23d4-4643-8fc3-6180844ba700

### Built with BigIDE

- [memory-game](https://github.com/az9713/memory-game) — A web-based memory card game created entirely by an AI agent inside BigIDE, from prompt to GitHub push.

---

## What is BigIDE?

BigIDE is a desktop application built with **Electron** (a framework that lets you build desktop apps using web technologies) and **React** (a JavaScript library for building user interfaces). It gives you a single workspace where you can run, monitor, and control multiple AI coding agents — such as Gemini CLI, Claude Code, OpenAI Codex, or GitHub Copilot — working across several projects at the same time.

Think of it as a mission control panel for AI-assisted software development. Instead of switching between browser tabs, terminals, and code editors, BigIDE brings everything into one place:

- Launch an agent in a sandboxed Git worktree (an isolated copy of the repository).
- Watch its terminal output in real time.
- Review the code changes it produces as a diff.
- Approve or reject actions through a governance system before they are committed.
- Create pull requests directly from the IDE.
- Track work items on a Kanban-style task board.

If you have experience with C, C++, or Java but are new to web or Electron development, the key thing to understand is that Electron apps have two separate execution environments that communicate over a message-passing interface (called IPC):

1. **Main process** — runs as a normal Node.js process, has full OS access (spawning terminals, reading files, calling Git).
2. **Renderer process** — runs inside a sandboxed Chromium (browser) instance, displays the UI.
3. **Preload script** — a trusted bridge that selectively exposes main-process capabilities to the renderer.

---

## Key Features

| Feature | Description |
|---|---|
| Multi-project canvas | Visual overview of all projects and tasks using a node-based canvas (React Flow) |
| Kanban task board | Create, assign, and track tasks through Todo / Running / Needs Review / Done / Error columns |
| Embedded terminal | Full xterm.js terminal with real PTY — clipboard support (Ctrl+C/V/A), right-click word select, auto-focus |
| Terminal tabs | Terminal tabs persist for running, needs-review, and error tasks; hidden not unmounted on tab switch |
| Code diff viewer | Unified diff view of every file changed by an agent (react-diff-view); auto-commits agent work on review |
| Governance / approval system | Intercept and approve or deny agent actions before they modify the repository |
| Git worktree isolation | Each task runs in its own Git worktree; auto-detects default branch; auto git init for new folders |
| Pull request creation | Create GitHub PRs via Octokit; auto-creates repo with `gh repo create`; shows PR URL on task card |
| Session reports | Auto-generated self-contained HTML report per task; saved to `.bigide-reports/`; cyan Report button |
| Real-time output parsing | Heuristic regex pipeline with 3-second startup grace period; strips ANSI from terminal output lines |
| Notification system | In-app notifications for task state changes, errors, and approvals needed |
| Browser panel | Embedded iframe backed by a local HTTP file server; auto-serves worktree on tab switch |
| Agent summary panel | Auto-generated Markdown summary of completed work; diff stats; tool activity grouped by type |
| Tool log panel | Structured timeline of every tool call made by the agent (file reads, writes, shell commands) |
| Persistent state | Project and task data is saved to disk between sessions (electron-store); stale tasks reset on restart |

---

## Tech Stack

| Technology | What it does | Version |
|---|---|---|
| **Electron** | Desktop app shell — wraps the Node.js backend and Chromium frontend into a single .exe/.app | 35 |
| **React** | Declarative UI library — components re-render automatically when state changes | 19 |
| **TypeScript** | Typed superset of JavaScript — catches type errors at compile time, similar to Java generics | 5 |
| **Vite** | Build tool and dev server — replaces Webpack, much faster hot-reload during development | 6 |
| **electron-vite** | Integrates Vite with Electron's multi-process build requirements | 3 |
| **TailwindCSS** | Utility-first CSS framework — style elements with class names instead of separate CSS files | 4 |
| **Zustand** | Lightweight global state management for React — simpler than Redux | 5 |
| **xterm.js** (`@xterm/xterm`) | Terminal emulator that runs in the browser/renderer — renders PTY output | 5 |
| **node-pty** | Native Node.js module that spawns a real Pseudo-Terminal on the OS (requires C++ build tools) | 1 |
| **simple-git** | Thin JavaScript wrapper around the system `git` binary | 3 |
| **React Flow** (`@xyflow/react`) | Interactive node-and-edge canvas for the project overview | 12 |
| **react-diff-view** | Renders unified and split diffs in React | 3 |
| **Octokit** | Official GitHub REST and GraphQL API client | 4 |
| **electron-store** | Simple persistent key-value store backed by a JSON file on disk | 8 |
| **react-resizable-panels** | Draggable panel dividers for the multi-pane layout | 2 |

---

## Prerequisites

Before you can run or build BigIDE, make sure the following are installed on your machine.

### 1. Node.js 18 or later

Node.js is the JavaScript runtime that powers both Electron's main process and the build tooling. Download it from [nodejs.org](https://nodejs.org). The LTS (Long Term Support) release is recommended.

Verify your installation:

```bash
node --version   # should print v18.x.x or higher
npm --version    # npm comes bundled with Node.js
```

### 2. Git

Git must be available on your `PATH` because BigIDE shells out to the `git` binary at runtime (via simple-git) for worktree management and diff generation.

```bash
git --version
```

### 3. Python 3.x and C++ build tools (for node-pty)

`node-pty` is a **native Node.js addon** — it contains C++ code that is compiled against your local Node.js and OS headers. This is similar to a JNI library in Java.

**Windows:**
```bash
npm install --global windows-build-tools
# or install "Desktop development with C++" from Visual Studio Installer
# Python is included with the above, or install from python.org
```

**macOS:**
```bash
xcode-select --install   # installs Clang and build tools
# Python 3 ships with macOS 12+
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install build-essential python3
```

### 4. An AI agent CLI (at least one)

BigIDE launches agents as subprocess commands. The **default model is Gemini CLI**. Install at least one:

- **Gemini CLI** (default) — `npm install -g @google/gemini-cli` (then `gemini`)
- **Claude Code** — `npm install -g @anthropic-ai/claude-code` (then `claude`)
- **OpenAI Codex** — `npm install -g @openai/codex` (then `codex`)
- **GitHub Copilot CLI** — install via `gh extension install github/gh-copilot` (then `gh copilot`)

Verify the agent command is on your `PATH`:
```bash
gemini --version
# or
claude --version
```

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-org/bigide.git
cd bigide
```

### 2. Install dependencies

```bash
npm install
```

This will also run the `postinstall` script which rebuilds `node-pty` against your installed version of Electron (native addons must be compiled specifically for the Electron Node.js version, not the system Node.js version).

If `postinstall` fails, you can rebuild manually:

```bash
npx electron-rebuild -f -w node-pty
```

### 3. Start in development mode

```bash
npm run dev
```

This command:
1. Starts the Vite dev server for the renderer (React UI) with hot-module replacement.
2. Compiles and watches the main process TypeScript.
3. Launches Electron, which opens the app window.

Changes to renderer code appear instantly without restarting. Changes to main-process code require a restart (press `Ctrl+R` in the app or re-run `npm run dev`).

### 4. The app opens

You should see the BigIDE window with:
- A left sidebar for navigation.
- A main canvas view showing your projects.
- A bottom panel area for terminals, diffs, and logs.

If the window does not open, check the terminal output for errors. The most common first-run issues are a missing native rebuild for `node-pty` or a missing AI agent binary.

---

## Project Structure

```
bigide/
├── package.json                  # Project metadata and npm scripts
├── electron-builder.yml          # Desktop packaging config (creates .exe / .dmg / .AppImage)
├── electron.vite.config.ts       # Vite build config for all three Electron processes
├── tsconfig.json                 # TypeScript compiler settings
│
├── docs/                         # Detailed documentation (see Documentation section below)
│   ├── getting-started-guide.md
│   ├── USER_GUIDE.md
│   ├── API_REFERENCE.md
│   ├── DEVELOPER_GUIDE.md
│   ├── ARCHITECTURE.md
│   ├── STUDY_PLAN.md
│   ├── ONBOARDING_WALKTHROUGH.md
│   ├── DEVELOPMENT_CHECKPOINT.md
│   └── BUGFIX_JOURNAL.md
│
└── src/
    ├── shared/
    │   └── types.ts              # TypeScript types shared between main and renderer
    │
    ├── preload/
    │   └── index.ts              # IPC bridge — exposes main-process APIs to the renderer
    │                             # (runs in a privileged context between the two processes)
    │
    ├── main/                     # Node.js / Electron main process
    │   ├── index.ts              # Entry point — creates BrowserWindow, registers IPC handlers
    │   ├── ipc-handlers.ts       # All IPC message handlers (the "server-side" API)
    │   ├── agent-launcher.ts     # Spawns agent subprocesses (gemini, claude, codex, etc.)
    │   ├── pty-manager.ts        # Manages PTY instances — one per terminal session
    │   ├── output-parser.ts      # Analyses agent PTY output; detects status, tools, errors
    │   ├── git-service.ts        # Git operations: worktree create/delete, diff, PR creation
    │   ├── governance-service.ts # Intercepts agent actions and emits approval requests
    │   ├── notification-service.ts # Queues and dispatches notifications to the renderer
    │   ├── tool-log-service.ts   # Records every tool call made by agents
    │   ├── report-service.ts     # Generates self-contained HTML session reports per task
    │   ├── file-server.ts        # Local HTTP server for Browser panel preview
    │   └── store.ts              # Persistent state on disk (electron-store wrapper)
    │
    └── renderer/                 # Chromium renderer process — the visible UI
        ├── index.html            # HTML shell that Electron loads
        ├── main.tsx              # React entry point — mounts <App /> into the DOM
        ├── App.tsx               # Root React component — routing between views
        ├── app.css               # Global CSS / Tailwind base imports
        ├── styles.css            # Additional global styles
        │
        ├── lib/
        │   └── types.ts          # Renderer-side TypeScript types
        │
        ├── stores/               # Zustand global state stores
        │   ├── workspace-store.ts   # Projects list, selected project, canvas layout
        │   ├── task-store.ts        # Tasks, their statuses, and agent assignments
        │   ├── governance-store.ts  # Pending approvals and governance history
        │   └── notification-store.ts # In-app notification queue
        │
        ├── hooks/                # Reusable React hooks
        │   ├── useIpc.ts            # Typed wrapper around window.electronAPI (the preload bridge)
        │   ├── useTerminal.ts       # Manages xterm.js lifecycle and PTY data streaming
        │   ├── useNotifications.ts  # Subscribes to notification events from main process
        │   └── useKeyboardShortcuts.ts # Global keyboard shortcut registration
        │
        └── components/           # React UI components
            ├── PanelLayout.tsx      # Resizable multi-panel layout (uses react-resizable-panels)
            ├── Sidebar.tsx          # Left navigation sidebar
            ├── ProjectView.tsx      # Per-project detail view
            ├── TaskBoard.tsx        # Kanban board — columns and drag-and-drop
            ├── TaskCard.tsx         # Individual task card component
            ├── TaskCreateModal.tsx  # Modal dialog to create a new task
            ├── TerminalPanel.tsx    # xterm.js terminal embedded in the UI
            ├── TerminalTabs.tsx     # Tab bar to switch between open terminal sessions
            ├── DiffPanel.tsx        # Displays file diffs using react-diff-view
            ├── AgentSummaryPanel.tsx # High-level agent status and activity summary
            ├── ToolLogPanel.tsx     # Scrollable log of agent tool calls
            ├── BrowserPanel.tsx     # Embedded webview / browser panel
            ├── GovernanceModal.tsx  # Approval/rejection dialog for governance events
            ├── NotificationBar.tsx  # Toast notification display
            ├── ErrorBoundary.tsx    # React error boundary — catches render errors gracefully
            └── canvas/
                ├── CanvasView.tsx   # React Flow canvas — renders project and task nodes
                ├── ProjectNode.tsx  # Custom node component for a project
                └── TaskNode.tsx     # Custom node component for a task
```

---

## Building for Production

To package BigIDE as a standalone desktop application:

### Step 1: Build the TypeScript and bundle the assets

```bash
npm run build
```

This compiles all TypeScript and bundles the renderer into `dist/`.

### Step 2: Package with electron-builder

```bash
npx electron-builder
```

electron-builder reads `electron-builder.yml` and produces a platform-specific installer or package:

| Platform | Output |
|---|---|
| Windows | `dist/release/BigIDE Setup x.x.x.exe` (NSIS installer) |
| macOS | `dist/release/BigIDE-x.x.x.dmg` |
| Linux | `dist/release/BigIDE-x.x.x.AppImage` |

To build for a specific platform explicitly:

```bash
npx electron-builder --win
npx electron-builder --mac
npx electron-builder --linux
```

> Note: Building for macOS requires running on a Mac (Apple code-signing and notarization are macOS-only processes).

---

## Architecture Overview

Understanding how the three Electron processes fit together helps when debugging or extending BigIDE.

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer Process (Chromium sandbox)                        │
│                                                             │
│  React + Zustand + xterm.js                                 │
│  Components → Stores → useIpc hook                          │
│                           │                                 │
│                    window.electronAPI                        │
└───────────────────────────┼─────────────────────────────────┘
                            │  preload/index.ts
                            │  (context bridge — serialised IPC)
┌───────────────────────────┼─────────────────────────────────┐
│  Main Process (Node.js)   │                                 │
│                           ▼                                 │
│  ipc-handlers.ts ──► agent-launcher.ts                      │
│         │           pty-manager.ts                          │
│         │           git-service.ts                          │
│         │           governance-service.ts                   │
│         │           output-parser.ts                        │
│         │           report-service.ts                       │
│         │           file-server.ts                          │
│         │           store.ts (disk)                         │
│         │                                                   │
│         └──────────────► OS: spawn(), pty, git, GitHub API  │
└─────────────────────────────────────────────────────────────┘
```

**Data flow for launching an agent:**

1. The user clicks "Run Agent" in the React UI (renderer).
2. The `useIpc` hook calls `window.electronAPI.launchAgent(taskId, agentName)`.
3. The preload script forwards this as an IPC message to the main process.
4. `ipc-handlers.ts` receives the message and calls `agent-launcher.ts`.
5. `agent-launcher.ts` spawns the agent CLI inside a `node-pty` PTY.
6. PTY output is streamed back to the renderer via IPC events and rendered by xterm.js.
7. Simultaneously, `output-parser.ts` watches the same stream for structured JSON events (tool calls, state changes) and updates the task store and tool log.

**Zustand stores** hold all UI state and act as a local cache of data received from the main process. Any component can subscribe to a store slice and will re-render automatically when that slice changes — no prop drilling needed.

---

## Documentation

Detailed guides are in the `docs/` folder:

| File | Contents |
|---|---|
| `docs/USER_GUIDE.md` | Full feature reference for end users |
| `docs/ONBOARDING_WALKTHROUGH.md` | Step-by-step walkthrough of your first agent run |
| `docs/API_REFERENCE.md` | IPC channel names, payloads, and the preload API surface |
| `docs/DEVELOPER_GUIDE.md` | Architecture deep-dive, how to add new agent types, extending the UI |
| `docs/ARCHITECTURE.md` | Detailed system architecture with data models and IPC patterns |
| `docs/STUDY_PLAN.md` | Self-paced learning plan for developers new to Electron/React |
| `docs/DEVELOPMENT_CHECKPOINT.md` | Feature implementation status and roadmap |
| `docs/BUGFIX_JOURNAL.md` | Chronological record of every bug found and fixed |

---

## Contributing

1. Fork the repository and create a feature branch from `main`.
2. Follow the existing code style — TypeScript strict mode, functional React components, Zustand for global state.
3. Keep main-process code in `src/main/` and UI code in `src/renderer/`. Put types shared between both in `src/shared/types.ts`.
4. Test your changes on the target platform (native modules like `node-pty` behave differently on Windows, macOS, and Linux).
5. Open a pull request with a clear description of what changed and why.

For larger changes, open an issue first to discuss the approach before writing code.

---

## License

This project is provided as a prototype/reference implementation. See `LICENSE` for terms.
