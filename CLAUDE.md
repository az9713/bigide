# BigIDE - Claude Code Context

## Project Overview

BigIDE is an Electron 35 + React 19 + TypeScript desktop application for orchestrating AI coding agents. It provides a multi-panel workspace for managing agent tasks, monitoring terminal output, reviewing diffs, and controlling agent permissions.

**Core dependencies:**
- Zustand - client state management
- TailwindCSS - utility-first styling
- xterm.js - terminal rendering
- node-pty - pseudo-terminal backend
- simple-git - Git operations
- electron-store - persistent disk storage

---

## Architecture

BigIDE follows a standard three-process Electron architecture:

### Main Process (`src/main/`)
Node.js backend responsible for:
- Window lifecycle management
- IPC channel registration and routing
- Git operations via simple-git
- PTY (pseudo-terminal) management via node-pty
- Agent process spawning
- Real-time terminal output parsing
- Governance permission checks
- Structured tool execution logging
- In-app notifications
- Persistent storage via electron-store

### Preload (`src/preload/`)
Security bridge that exposes a controlled `window.bigide` API surface to the renderer using Electron's `contextBridge`. All renderer-to-main communication must go through this bridge.

### Renderer (`src/renderer/`)
React 19 UI layer containing:
- Zustand stores for application state
- React components (panels, modals, views)
- Custom hooks for IPC, keyboard shortcuts, terminals, notifications

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | App lifecycle, window creation |
| `src/main/ipc-handlers.ts` | All IPC endpoint registrations |
| `src/main/pty-manager.ts` | node-pty terminal management |
| `src/main/agent-launcher.ts` | Agent process spawning |
| `src/main/git-service.ts` | Git worktree, diff, merge, PR operations |
| `src/main/output-parser.ts` | Real-time terminal output pattern matching |
| `src/main/governance-service.ts` | Permission checking and approval workflow |
| `src/main/tool-log-service.ts` | Structured execution logging |
| `src/main/store.ts` | Persistent storage via electron-store |
| `src/main/notification-service.ts` | In-app notification system |
| `src/main/report-service.ts` | Generates self-contained HTML session reports per task |
| `src/main/file-server.ts` | Local HTTP file server for Browser panel preview (serves worktree files) |
| `src/preload/index.ts` | contextBridge API surface |
| `src/renderer/App.tsx` | Root component, view switching |
| `src/renderer/stores/` | Zustand stores (workspace, task, notification, governance) |
| `src/shared/types.ts` | Shared TypeScript interfaces used across processes |

---

## Commands

```bash
npm run dev        # Development mode with hot reload
npm run build      # Build for production
npm run preview    # Preview production build
```

---

## Conventions

### IPC Channels
Channels use kebab-case with a colon namespace separator:

```
task:create
task:update
git:worktree-list
git:diff
agent:launch
agent:stop
```

### Zustand Stores
Stores follow the interface + `create` pattern:

```typescript
interface MyState {
  items: Item[];
  addItem: (item: Item) => void;
}

export const useMyStore = create<MyState>(set => ({
  items: [],
  addItem: (item) => set(state => ({ items: [...state.items, item] })),
}));
```

### Components
- PascalCase `.tsx` files in `src/renderer/components/`
- TailwindCSS utility classes for all styling (no CSS modules)
- Error boundaries wrap major UI sections

### Hooks
- Located in `src/renderer/hooks/`
- Prefixed with `use` (e.g., `useIpc`, `useTerminal`, `useNotifications`)

### IPC Calls
All IPC calls from the renderer must go through the preload bridge:

```typescript
// Correct
window.bigide.task.create(data)

// Never use ipcRenderer directly in renderer code
```

---

## Important Notes

### node-pty Native Module
node-pty is a native Node.js module and must be rebuilt for the specific Electron version before the app will run. This is handled automatically during the build process via `electron-rebuild`.

### Git Worktrees
Agent tasks that require isolated Git contexts create worktrees under `.bigide-worktrees/` in the project root. Each worktree maps to a separate branch for the task.

### Agent Models
`agent-launcher.ts` contains `MODEL_COMMANDS`, which maps model keys to CLI command templates. The supported models in order are:
- `gemini-cli` — **default**; runs `gemini -i "<prompt>"` (interactive mode — no `-m` flag)
- `claude-code` — runs `claude "<prompt>"`
- `codex` — runs `codex "<prompt>"`
- `copilot` — runs `gh copilot suggest "<prompt>"`
- `custom` — placeholder for user-defined commands

### Output Parser
`output-parser.ts` runs regex patterns against streaming terminal output to detect agent status changes (e.g., task completion, errors, tool invocations) in real time. New status patterns should be added here. Completion patterns include phrases such as `I've completed/finished/created/implemented/added/fixed/updated`, `Total cost:`, `tokens used`, and `session ended`.

### Session Reports
`report-service.ts` generates a self-contained HTML file for each completed task. Reports are written to `.bigide-reports/` in the project directory and opened in the system browser via `shell.openExternal`. They are auto-triggered when a task transitions to `needs-review` or `done`, and can be regenerated on demand via the `task:generate-report` IPC handler.

Four new fields were added to `AgentTask` in `src/shared/types.ts` to support reports:
- `terminalLog: string[]` — cleaned terminal output lines (ANSI stripped), capped at 2000 lines, accumulated by `output-parser.ts`
- `startedAt: number | null` — Unix timestamp (ms) when the task moved to `running`
- `completedAt: number | null` — Unix timestamp (ms) when the task moved to `needs-review` or `done`
- `reportPath: string | null` — absolute path to the most recently generated HTML report

### Governance
`governance-service.ts` performs permission checks as agent output is parsed. Certain agent actions (file writes, shell commands, network calls) may require user approval before proceeding. Approval state is managed in the governance Zustand store.

### Persistence
`electron-store` automatically persists projects and tasks to disk. The store is initialized in `src/main/store.ts` and accessed via IPC from the renderer. Do not write project or task state directly to the filesystem outside of this store.
