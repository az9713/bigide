# BigIDE Architecture

BigIDE is a desktop IDE built with Electron 35, React 19, and TypeScript. Its purpose is to
orchestrate AI coding agents — launching them in isolated Git worktrees, watching their terminal
output, and presenting diffs for human review before merging back to main.

This document is written for engineers familiar with C/C++ or Java desktop applications who have
not previously worked with Electron or web-based UI frameworks.

---

## Table of Contents

1. [Mental Model: How Electron Compares to a Native Desktop App](#1-mental-model)
2. [High-Level Process Architecture](#2-high-level-process-architecture)
3. [Main Process — The Backend](#3-main-process)
4. [Preload Bridge — The Security Boundary](#4-preload-bridge)
5. [Renderer Process — The Frontend](#5-renderer-process)
6. [IPC Communication Patterns](#6-ipc-communication-patterns)
7. [Data Models](#7-data-models)
8. [Task Lifecycle: End-to-End Flow](#8-task-lifecycle)
9. [Git Worktree Strategy](#9-git-worktree-strategy)
10. [Output Parser Pipeline](#10-output-parser-pipeline)
11. [Governance System](#11-governance-system)
12. [Component Hierarchy](#12-component-hierarchy)
13. [State Management with Zustand](#13-state-management-with-zustand)
14. [Security Model](#14-security-model)
15. [External Dependencies](#15-external-dependencies)
16. [Directory Structure](#16-directory-structure)

---

## 1. Mental Model

### How Electron compares to a native desktop app

If you have written a desktop application in Java Swing, Qt, or Win32, you are used to a single
process with a main loop that both runs business logic and paints the UI. Everything shares the
same memory space and you call OS APIs directly.

Electron is different. It is a runtime that bundles two separate JavaScript engines into one
executable:

| Concept you know | Electron equivalent |
|---|---|
| Main application process | Main process (Node.js) |
| UI thread / window | Renderer process (Chromium) |
| OS API calls | Node.js built-ins and native add-ons |
| IPC / message queue between threads | Electron IPC (ipcMain / ipcRenderer) |
| Shared memory between threads | Not used — message passing only |
| DLL / .so native library | Native add-on (.node file, compiled C++) |

The key insight is that the **renderer process is a sandboxed Chromium browser tab**. It renders
HTML, CSS, and JavaScript exactly like a web page would. It cannot touch the file system, spawn
processes, or call any OS API directly. All of that must happen in the main process, with the
renderer asking for it via IPC messages.

---

## 2. High-Level Process Architecture

```
+====================================================================================+
|                              BigIDE Application                                    |
|                                                                                    |
|  +------------------+     +-------------------+     +---------------------------+ |
|  |   Main Process   |     |  Preload Script   |     |    Renderer Process       | |
|  |   (Node.js)      |     |  (contextBridge)  |     |    (Chromium + React)     | |
|  |                  |     |                   |     |                           | |
|  |  ipc-handlers.ts |<--->| window.bigide.xxx |<--->|  Components + Zustand     | |
|  |  pty-manager.ts  |     |                   |     |  Stores                   | |
|  |  agent-launcher  |     | Acts as typed API |     |                           | |
|  |  git-service.ts  |     | surface. Renderer |     |  Cannot access Node.js    | |
|  |  output-parser   |     | never sees Node   |     |  APIs directly            | |
|  |  governance      |     | internals.        |     |                           | |
|  |  store.ts        |     |                   |     |                           | |
|  |  notifications   |     +-------------------+     +---------------------------+ |
|  +-------+----------+                                                             |
|          |                                                                         |
|  +-------v--------------------------------------------------+                    |
|  |                  External Systems                        |                    |
|  |                                                          |                    |
|  |  File System       Git Repos       AI Agent CLIs        |                    |
|  |  (electron-store)  (simple-git)    (gemini / claude /   |                    |
|  |                    (Octokit)        codex / gh copilot)  |                    |
|  |                                    via node-pty          |                    |
|  +----------------------------------------------------------+                    |
+====================================================================================+
```

---

## 3. Main Process

**Location:** `src/main/`

Think of the main process as the server-side or backend of the application. It starts first,
creates windows, and owns all privileged resources. Node.js runs here, so it can read files,
spawn child processes, make network calls, and use native C++ add-ons.

### 3.1 index.ts — Application Bootstrap

`src/main/index.ts` is the entry point. Its responsibilities are:

1. Create the `BrowserWindow` (the visible OS window) with security policies.
2. Register all IPC handlers before the window loads.
3. Handle window lifecycle (macOS re-open behaviour, quit on last window close).

```typescript
// src/main/index.ts (key section)
mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,   // renderer cannot access Node globals
    nodeIntegration: false,   // no require() in renderer
    sandbox: false,           // preload needs some Node APIs
  }
})
```

`contextIsolation: true` and `nodeIntegration: false` are the two most important security flags.
They are analogous to running untrusted code in a sandboxed process with no OS API access.

External links are intercepted and opened in the system browser rather than inside the app:

```typescript
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  shell.openExternal(url)
  return { action: 'deny' }
})
```

### 3.2 ipc-handlers.ts — The RPC Registry

`src/main/ipc-handlers.ts` registers 22 request-response IPC channel handlers plus handles
two unidirectional write channels (`terminal:write` and `preview:serve`/`preview:stop`). Think
of each `ipcMain.handle(channel, handler)` call as registering a remote procedure. The renderer
calls them asynchronously and awaits the response — exactly like an RPC call over a socket.

Channels are namespaced by domain:

| Namespace | Channels | Purpose |
|---|---|---|
| `project:` | list, add, remove, update-canvas-position, select-directory | Project CRUD |
| `task:` | list, create, start, stop, send-input, get-diff, update-status, cleanup, get-tool-log, get-summary, create-pr, check-permission, generate-report | Full task lifecycle |
| `terminal:` | resize, write | PTY window size and direct keystroke injection |
| `git:` | worktree-list, merge-branch | Git operations |
| `preview:` | serve, stop | Local file server for Browser panel |
| `governance:` | respond | Approve or deny an agent action |

Registration pattern:

```typescript
// src/main/ipc-handlers.ts
export function registerIpcHandlers(): void {
  ipcMain.handle('project:list', () => getProjects())

  ipcMain.handle('task:create', async (_, taskData) => {
    const task: AgentTask = { ...taskData, id: randomUUID(), worktreePath: null, ... }
    const project = getProjects().find(p => p.id === task.projectId)
    if (project) {
      const wtPath = await createWorktree(project.rootPath, task.branchName, project.defaultBranch)
      task.worktreePath = wtPath
    }
    addTask(task)
    return task
  })
  // ... ~18 more handlers
}
```

### 3.3 pty-manager.ts — Pseudo-Terminal Management

`src/main/pty-manager.ts` wraps `node-pty`, a native C++ add-on that creates POSIX pseudo-
terminals (PTYs) on Linux/macOS and ConPTY on Windows. A PTY is what gives you a real interactive
terminal — the AI agent sees a full terminal environment complete with ANSI colour codes, line
editing, and signal handling.

The manager keeps a `Map<string, PtyInstance>` (ptyId to IPty). This is a long-lived registry —
PTYs outlive any single IPC call.

```typescript
// src/main/pty-manager.ts
const ptys = new Map<string, PtyInstance>()

export function createPty(id: string, cwd: string, shell?: string): string {
  const proc = pty.spawn(shellPath, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: { ...process.env }
  })
  ptys.set(id, { process: proc, id })

  // Forward every byte to the renderer via IPC push event
  proc.onData((data: string) => {
    win.webContents.send('terminal:data', id, data)
  })
  return id
}
```

Data flows one-way from the PTY to the renderer as push events (not request-response). The
renderer never polls; it subscribes to the `terminal:data` event channel.

Key functions:
- `createPty(id, cwd, shell?)` — spawn a new PTY, begin forwarding data
- `writeToPty(id, data)` — send keystrokes or commands into the PTY
- `killPty(id)` — kill the PTY process and remove from registry
- `resizePty(id, cols, rows)` — resize the terminal window (sent when UI panel resizes)
- `getPty(id)` — return the raw IPty object (used by output-parser to attach its own listener)

### 3.4 agent-launcher.ts — AI Agent Spawning

`src/main/agent-launcher.ts` knows how to start each supported AI agent. It uses the PTY as the
transport layer — agents run as interactive CLI programs inside a shell.

Model-to-command mapping:

```typescript
// src/main/agent-launcher.ts
const MODEL_COMMANDS: Record<string, (prompt: string) => string> = {
  'gemini-cli':  (prompt) => `gemini -i "${prompt.replace(/"/g, '\\"')}"\r`,
  'claude-code': (prompt) => `claude "${prompt.replace(/"/g, '\\"')}"\r`,
  'codex':       (prompt) => `codex "${prompt.replace(/"/g, '\\"')}"\r`,
  'copilot':     (prompt) => `gh copilot suggest "${prompt.replace(/"/g, '\\"')}"\r`,
  'custom':      (prompt) => `# Custom agent: paste your command\r`
}

// Default model (used when no model is specified or as fallback)
const DEFAULT_MODEL = 'gemini-cli'
```

Launch sequence:

1. Determine the working directory — use `task.worktreePath` if it exists, otherwise fall back to
   the project root. The worktree is the agent's isolated sandbox; it sees only its own branch.
2. Create a PTY in that directory (`createPty`).
3. Record `taskId → ptyId` in the `activeAgents` map.
4. Attach the output parser (`startOutputParsing`).
5. After 1 second (shell init time), write the agent command into the PTY.

Stopping an agent sends `\x03` (Ctrl+C) first, then kills the PTY after 500 ms — the same
graceful shutdown sequence you would use from a terminal manually.

### 3.5 git-service.ts — Git Integration

`src/main/git-service.ts` uses the `simple-git` library to perform all Git operations. It also
uses `Octokit` (GitHub's official REST API client) to create pull requests.

Key operations:

| Function | What it does |
|---|---|
| `createWorktree(repoPath, branchName, baseBranch)` | `git worktree add -b <branch> <path> <base>` — creates an isolated checkout |
| `removeWorktree(repoPath, worktreePath)` | `git worktree remove --force` — cleans up after a task |
| `listWorktrees(repoPath)` | Parses `git worktree list --porcelain` output |
| `getDiff(repoPath, branch, base)` | `git diff <base>...<branch>` — three-dot diff |
| `getDiffStats(repoPath, branch, base)` | `git diff --stat` — files changed, insertions, deletions |
| `mergeBranch(repoPath, branchName)` | `git merge <branch>` |
| `createPullRequest(project, task)` | Pushes branch, then calls Octokit `pulls.create` |

The GitHub token is resolved in order: `GITHUB_TOKEN` env var first, then `gh auth token` CLI
command. This avoids hard-coding credentials.

### 3.6 output-parser.ts — Terminal Output Analysis

`src/main/output-parser.ts` analyses the raw character stream coming out of a PTY to infer what
the agent is doing and whether any action is needed. This is the most heuristic-heavy component.

It maintains per-task `ParserState` objects with an accumulating text buffer. The buffer is capped
at 10,000 characters (last 5,000 kept on overflow) to avoid unbounded memory growth.

Regex pattern sets (see section 10 for the full pipeline diagram):

```typescript
// Status detection
const NEEDS_INPUT_PATTERNS = [
  /^[>❯]\s*$/m,        // bare prompt character
  /\?\s*$/m,           // line ending with question mark
  /\(y\/n\)/i,         // yes/no prompt
  /press enter/i,
  /waiting for input/i
]

const COMPLETION_PATTERNS = [
  /[✓✔]\s*.+completed/i,
  /successfully\s+(created|updated|fixed|added|implemented)/i,
  /all\s+\d+\s+tests?\s+passed/i,
  /done[.!]?\s*$/im
]

// Tool-call recognition for structured logging
const TOOL_PATTERNS = [
  { pattern: /(?:Edited|Created|Wrote)\s+(.+)$/m, tool: 'file_edit' },
  { pattern: /(?:Read|Reading)\s+(.+)$/m,         tool: 'file_read' },
  { pattern: /\$\s+(.+)$/m,                       tool: 'bash'      },
  { pattern: /(?:Searched|Grep|Glob)\s+(.+)$/m,   tool: 'search'    },
  { pattern: /(?:WebFetch|WebSearch)\s+(.+)$/m,   tool: 'web'       }
]

// Governance tripwires
const GOVERNANCE_PATTERNS = [
  /\$\s+(git\s+push)/i,
  /\$\s+(rm\s+-rf)/i,
  /\$\s+(npm\s+publish)/i,
  /\$\s+(deploy)/i
]
```

An idle timer fires every 5 seconds and checks whether the PTY has been silent for more than
30 seconds. If it has, it flags the task as potentially needing input.

When a status change is detected, the parser calls `win.webContents.send('task:status-changed',
...)` — a push event to the renderer — and also calls `updateTask` to persist the new status.

### 3.7 governance-service.ts — Permission Enforcement

`src/main/governance-service.ts` implements a two-phase permission system.

Phase 1 — synchronous capability check (`checkPermission`):
Checks broad boolean flags on the task's `TaskPermissions` object. Returns `false` immediately if
a category of action is not allowed at all.

Phase 2 — async approval flow (`checkGovernanceAction`):
Called by the output parser when a governance-sensitive command is detected in the PTY stream.
Sends `governance:approval-needed` as a push event to the renderer. The renderer shows a modal.
When the user responds, `handleGovernanceResponse` is called via IPC. On denial, `\x03` is written
to the PTY to cancel.

```typescript
// src/main/governance-service.ts
export function checkGovernanceAction(taskId: string, action: string): void {
  const needsApproval = task.permissions.requireApprovalFor.some(pattern =>
    action.toLowerCase().includes(pattern.toLowerCase())
  )
  if (needsApproval) {
    win.webContents.send('governance:approval-needed', taskId, action, `Agent wants to execute: ${action}`)
    logToolCall(taskId, { tool: 'governance', args: `Approval requested: ${action}`, ... })
  }
}

export function handleGovernanceResponse(taskId: string, approved: boolean): void {
  if (!approved && task.ptyId) {
    writeToPty(task.ptyId, '\x03') // Ctrl+C
  }
}
```

Default permissions (`DEFAULT_PROJECT_PERMISSIONS`):

| Permission | Default | Meaning |
|---|---|---|
| `allowFileWrite` | `true` | Agent may edit files |
| `allowBash` | `true` | Agent may run shell commands |
| `allowNetworkAccess` | `false` | Agent may not make network requests |
| `allowGitPush` | `false` | Agent may not push to remote |
| `requireApprovalFor` | `['git push', 'rm -rf', 'npm publish', 'deploy']` | Commands needing human approval |

### 3.8 tool-log-service.ts — Tool Activity Logging

`src/main/tool-log-service.ts` accumulates `ToolLogEntry` records on each task and provides a
`generateAgentSummary` function that produces a Markdown summary grouping file operations, bash
commands, and diff statistics.

Each new entry is also pushed to the renderer via `task:tool-logged` so the ToolLogPanel can
update in real time.

### 3.9 report-service.ts — Session Report Generation

`src/main/report-service.ts` generates a self-contained HTML report for a completed task and writes it to a `.bigide-reports/` directory inside the project root. The file is opened in the system browser via Electron's `shell.openExternal`.

Reports are triggered automatically when `output-parser.ts` transitions a task to `needs-review` or `done`, and can be regenerated on demand via the `task:generate-report` IPC handler.

Report contents:
- Task metadata: title, model, status, branch name
- Timestamps: `startedAt`, `completedAt`, duration
- Original prompt
- PR URL (if created)
- Diff stats and full color-coded diff (green/red)
- Agent summary Markdown
- Tool log timeline
- Governance decisions
- Terminal transcript (`terminalLog` — ANSI-stripped, up to 2000 lines)
- Footer with generation timestamp and project path

The service depends on four new fields on `AgentTask` (defined in `src/shared/types.ts`):

| Field | Type | Purpose |
|---|---|---|
| `terminalLog` | `string[]` | ANSI-cleaned output lines, max 2000 |
| `startedAt` | `number \| null` | Unix ms timestamp when task started |
| `completedAt` | `number \| null` | Unix ms timestamp when task completed |
| `reportPath` | `string \| null` | Absolute path to the latest HTML report |

### 3.11 store.ts — Persistent Storage

`src/main/store.ts` uses `electron-store`, which serialises state to a JSON file in the OS app-
data directory. Think of it as a simple JSON database file — no SQL, no migrations, no ORM.

The schema is `{ projects: Project[], tasks: AgentTask[] }`. The file is named `bigide-state.json`
and lives at:
- Windows: `%APPDATA%\bigide\bigide-state.json`
- macOS: `~/Library/Application Support/bigide/bigide-state.json`
- Linux: `~/.config/bigide/bigide-state.json`

Key functions: `getProjects`, `setProjects`, `getTasks`, `setTasks`, `addProject`,
`removeProject`, `addTask`, `getTask`, `updateTask`.

`updateTask` is used heavily throughout the main process — it performs a full read-modify-write of
the tasks array on every status change.

### 3.12 notification-service.ts — In-Memory Notification Ring Buffer

`src/main/notification-service.ts` maintains an in-memory array (not persisted) of up to 100
recent `Notification` objects. When the array exceeds 100 entries, the oldest entries are
trimmed. Each new notification is pushed to the renderer via `notification:new`.

---

## 4. Preload Bridge

**Location:** `src/preload/index.ts`

The preload script is loaded by Electron into an isolated JavaScript context that has access to
both Node.js APIs and the DOM. Its sole job is to expose a safe, typed API surface to the
renderer using `contextBridge.exposeInMainWorld`.

Think of this as defining a COM interface or a JNI bridge — it is the only sanctioned crossing
point between the sandboxed renderer and the privileged main process.

```typescript
// src/preload/index.ts
contextBridge.exposeInMainWorld('bigide', {
  // Request-response (invoke → handle)
  projectList: () => ipcRenderer.invoke('project:list'),
  taskCreate:  (task: any) => ipcRenderer.invoke('task:create', task),
  taskStart:   (taskId: string) => ipcRenderer.invoke('task:start', taskId),
  // ...

  // Event subscriptions (push events: main → renderer)
  onTerminalData: (cb) => {
    const listener = (_, ptyId, data) => cb(ptyId, data)
    ipcRenderer.on('terminal:data', listener)
    return () => ipcRenderer.removeListener('terminal:data', listener)  // cleanup fn
  },
  onTaskStatusChanged: (cb) => { ... },
  onGovernanceApprovalNeeded: (cb) => { ... },
  onNotification: (cb) => { ... }
})
```

Every event-subscription function returns a cleanup function (a `() => void`). Callers must call
this function when they are done listening to avoid memory leaks — the equivalent of
`RemoveEventListener` or unsubscribing from an observable.

After the bridge is set up, `window.bigide` is available in the renderer as a plain JavaScript
object. TypeScript knows the full type of this object because the preload file exports
`type BigIdeApi = typeof api`.

---

## 5. Renderer Process

**Location:** `src/renderer/`

The renderer is a React 19 single-page application running inside a Chromium window. It has no
access to Node.js APIs and communicates exclusively through `window.bigide`.

Technologies used:
- **React 19** — functional components with hooks. No class components.
- **Zustand** — lightweight state management (explained in section 13).
- **TailwindCSS v4** — utility-first CSS. No separate CSS files per component.
- **@xyflow/react** — interactive node-graph canvas (React Flow).
- **@xterm/xterm** — browser-based terminal emulator.
- **react-diff-view** — renders unified diffs with syntax highlighting.
- **react-resizable-panels** — drag-to-resize panel layout.

---

## 6. IPC Communication Patterns

There are two patterns of IPC in BigIDE:

### Pattern A — Request / Response (invoke / handle)

Used for all operations that return a value or need to complete before the UI updates.

```
Renderer                     Preload               Main Process
   |                            |                       |
   | window.bigide.taskStart()  |                       |
   |--------------------------->|                       |
   |                   ipcRenderer.invoke('task:start') |
   |                            |---------------------->|
   |                            |                       | (async work)
   |                            |       return result   |
   |                            |<----------------------|
   | Promise resolves           |                       |
   |<---------------------------|                       |
```

### Pattern B — Push Events (send / on)

Used for continuous data streams where the main process needs to notify the renderer without
being asked — terminal output, status changes, governance alerts.

```
Main Process              Preload (listener)         Renderer
   |                            |                       |
   | (PTY emits data)           |                       |
   | win.webContents.send(      |                       |
   |   'terminal:data', id, d)  |                       |
   |--------------------------->|                       |
   |                 ipcRenderer.on('terminal:data')    |
   |                            | cb(id, d)             |
   |                            |---------------------->|
   |                            |         React re-renders xterm
```

### Complete IPC Channel Catalogue

**Request-Response channels (renderer calls main):**

| Channel | Arguments | Returns | Handler |
|---|---|---|---|
| `project:list` | — | `Project[]` | `getProjects()` |
| `project:add` | project data | `Project` | Creates with UUID, random canvas position |
| `project:remove` | id | void | Removes project and all its tasks |
| `project:update-canvas-position` | id, {x,y} | void | Updates canvas drag position |
| `project:select-directory` | — | `string \| null` | Native folder picker dialog |
| `task:list` | projectId | `AgentTask[]` | Filter tasks by project |
| `task:create` | task data | `AgentTask` | Creates task, creates Git worktree |
| `task:start` | taskId | void | Launches agent in PTY |
| `task:stop` | taskId | void | Ctrl+C then kill PTY |
| `task:send-input` | taskId, input | void | Write to PTY |
| `task:get-diff` | taskId | string | `git diff base...branch` |
| `task:update-status` | taskId, status | void | Persist status change |
| `task:cleanup` | taskId | void | Kill PTY, remove worktree |
| `task:get-tool-log` | taskId | `ToolLogEntry[]` | Return tool log array |
| `task:get-summary` | taskId | `string \| null` | Return Markdown summary |
| `task:create-pr` | taskId | string (URL) | Push branch, create GitHub PR |
| `terminal:resize` | ptyId, cols, rows | void | Resize PTY |
| `git:worktree-list` | projectId | `string[]` | List worktree paths |
| `git:merge-branch` | projectId, branch | void | `git merge` |
| `task:check-permission` | taskId, action | boolean | Synchronous permission check |
| `task:generate-report` | taskId | string (file path) | Generate (or regenerate) HTML session report |
| `terminal:write` | ptyId, data | void | Write directly to PTY (bypasses agent — survives agent stop) |
| `preview:serve` | taskId | number (port) | Start local HTTP file server for Browser panel |
| `preview:stop` | taskId | void | Stop the local HTTP file server |
| `governance:respond` | taskId, approved | void | Approve or deny action |

**Push events (main sends to renderer):**

| Channel | Arguments | Meaning |
|---|---|---|
| `terminal:data` | ptyId, data | Terminal output chunk |
| `task:status-changed` | taskId, status, needsInput | Agent changed state |
| `task:tool-logged` | taskId, entry | New tool call recorded |
| `governance:approval-needed` | taskId, action, detail | Agent needs permission |
| `notification:new` | Notification | New notification created |

---

## 7. Data Models

All shared types live in `src/shared/types.ts` and are imported by both main and renderer.

### Project

```typescript
interface Project {
  id: string                          // UUID, generated at creation
  name: string                        // Display name (derived from folder name)
  rootPath: string                    // Absolute path to the git repo on disk
  defaultBranch: string               // "main" or "master"
  browserUrl?: string                 // Optional URL for BrowserPanel (e.g. localhost:3000)
  githubRepo?: string                 // "owner/repo" for PR creation
  canvasPosition: { x: number; y: number } // Node position on the CanvasView
}
```

### AgentTask

```typescript
interface AgentTask {
  id: string                          // UUID
  projectId: string                   // FK to Project
  title: string                       // Short human-readable description
  prompt: string                      // Full instruction sent to the agent
  status: TaskStatus                  // Current lifecycle state
  branchName: string                  // Git branch the agent works on
  worktreePath: string | null         // Absolute path to the git worktree
  ptyId: string | null                // ID of the PTY (null if not running)
  needsInput: boolean                 // True when agent is waiting for user input
  lastOutputLine: string              // Most recent line from agent output (for UI)
  model: string                       // "gemini-cli" (default) | "claude-code" | "codex" | "copilot" | "custom"
  agentSummary: string | null         // Generated Markdown summary of agent activity
  toolLog: ToolLogEntry[]             // Ordered list of tool calls made by agent
  diffStats: { filesChanged: number; insertions: number; deletions: number } | null
  permissions: TaskPermissions        // What this task is allowed to do
  prUrl: string | null                // GitHub PR URL once created
  terminalLog: string[]               // ANSI-cleaned output lines, capped at 2000
  startedAt: number | null            // Unix ms timestamp when task moved to "running"
  completedAt: number | null          // Unix ms timestamp when task moved to "needs-review" or "done"
  reportPath: string | null           // Absolute path to the latest generated HTML report
}
```

### TaskStatus

```typescript
type TaskStatus = 'todo' | 'running' | 'needs-review' | 'done' | 'error'
```

State machine transitions:

```
         +--------+
         |  todo  |
         +---+----+
             | task:start
             v
         +--------+       idle >30s      +--------------+
         |running |--------------------->| needs-input  |
         +---+----+                      +------+-------+
             |                                  | user sends input
             | completion pattern               v
             +------------------+          +--------+
             |                  |          |running |
             v                  |          +--------+
      +-------------+           |
      | needs-review|           | error pattern
      +------+------+           |
             |                  v
             | merge/done   +-------+
             v              | error |
          +------+          +---+---+
          | done |              | retry (manual)
          +------+              v
                            +--------+
                            |running |
                            +--------+
```

### ToolLogEntry

```typescript
interface ToolLogEntry {
  timestamp: number          // Unix milliseconds
  tool: string               // 'file_edit' | 'file_read' | 'bash' | 'search' | 'web' | 'governance'
  args: string               // The argument or file path
  result: 'success' | 'error'
  filesAffected: string[]    // Files touched by this operation
}
```

### TaskPermissions

```typescript
interface TaskPermissions {
  allowFileWrite: boolean       // Agent may write/edit files
  allowBash: boolean            // Agent may run shell commands
  allowNetworkAccess: boolean   // Agent may make HTTP requests
  allowGitPush: boolean         // Agent may push to remote
  requireApprovalFor: string[]  // Substrings that trigger approval modal
}

// Defaults applied to every new task:
const DEFAULT_PERMISSIONS: TaskPermissions = {
  allowFileWrite: true,
  allowBash: true,
  allowNetworkAccess: false,
  allowGitPush: false,
  requireApprovalFor: ['git push', 'rm -rf', 'npm publish', 'deploy']
}
```

### Notification

```typescript
interface Notification {
  id: string
  taskId: string
  projectId: string
  type: 'needs-input' | 'completed' | 'error' | 'approval-needed'
  message: string
  timestamp: number   // Unix milliseconds
  read: boolean
}
```

---

## 8. Task Lifecycle: End-to-End Flow

```
User clicks "New Task"
         |
         v
  TaskCreateModal opens
  User fills in: title, prompt, model, branch name, permissions
         |
         | window.bigide.taskCreate(taskData)
         v
  Main: ipcMain.handle('task:create')
    - generate UUID
    - git.worktree add -b <branch> <path> <baseBranch>
    - persist task to electron-store
    - return task object
         |
         v
  Renderer: task appears in TaskBoard with status "todo"
         |
         | User clicks "Start"
         | window.bigide.taskStart(taskId)
         v
  Main: ipcMain.handle('task:start')
    - createPty('agent-<taskId>', worktreePath)
    - activeAgents.set(taskId, ptyId)
    - startOutputParsing(taskId, ptyId)
    - setTimeout(1000ms) => writeToPty(ptyId, 'claude "prompt"\r')
    - updateTask(taskId, { status: 'running' })
         |
         |  terminal:data events flow to renderer continuously
         v
  Renderer: TerminalPanel renders xterm.js with live output
  OutputParser: analyses each data chunk
         |
         +--[governance pattern detected]---> governance:approval-needed event
         |                                        |
         |                               GovernanceModal opens
         |                               User approves or denies
         |                               governance:respond IPC
         |                                        |
         |                               Approved: agent continues
         |                               Denied: Ctrl+C sent to PTY
         |
         +--[completion pattern detected]---> task:status-changed (needs-review)
         |
         v
  Renderer: task moves to "needs-review" column
  User opens DiffPanel: window.bigide.taskGetDiff(taskId)
         |
         v
  DiffPanel shows react-diff-view with coloured hunks
         |
         +--[Approve & Merge]---> window.bigide.gitMergeBranch(projectId, branch)
         |                        updateTask({ status: 'done' })
         |
         +--[Create PR]-----> window.bigide.taskCreatePr(taskId)
                              git push origin branch
                              octokit.rest.pulls.create(...)
                              returns PR URL
                              task.prUrl set
```

---

## 9. Git Worktree Strategy

Git worktrees allow multiple checked-out branches of the same repository to exist simultaneously
on disk, each in a separate directory. BigIDE uses this to give each agent task a completely
isolated file system view.

```
  /path/to/my-project/          <- Main working tree (your main branch)
  /path/to/.bigide-worktrees/
      feature-auth/             <- Worktree for task "Add authentication"
      fix-memory-leak/          <- Worktree for task "Fix memory leak"
      refactor-api/             <- Worktree for task "Refactor API layer"
```

The worktree directory is one level above the project root (in `.bigide-worktrees/` sibling
directory) to keep it outside the repo but close to it.

```
Main Branch (e.g. "main")
       |
       | git worktree add -b <branchName> <worktreePath> main
       |
       v
  Isolated Worktree Created
       |
       | Agent is launched with cwd = worktreePath
       | Agent reads, writes, runs commands ONLY in worktreePath
       v
  Agent Works (no effect on main branch)
       |
       | Agent completes, output-parser detects completion
       v
  Status → "needs-review"
       |
       | User reviews git diff base...branch
       v
  User Approves
       |
       +---[Merge]---> git merge <branch> (into main)
       |               git worktree remove (cleanup)
       |
       +---[PR]-----> git push origin <branch>
                      octokit creates PR on GitHub
                      worktree optionally cleaned up
```

The three-dot diff (`git diff main...feature-branch`) shows only the commits that are on the
feature branch but not on main — precisely the agent's work.

---

## 10. Output Parser Pipeline

The output parser is the heuristic engine that bridges raw terminal bytes to structured task
state. It runs entirely in the main process.

```
PTY Process (agent running)
       |
       | Raw bytes (ANSI escape codes, text, control chars)
       v
  pty.onData(data) callback
       |
       v
  processOutput(taskId, data)
       |
       +-- Append to rolling buffer (max 10,000 chars)
       |
       +-- Update task.lastOutputLine (last non-empty line, max 200 chars)
       |
       +-- GOVERNANCE CHECK (first priority)
       |     For each GOVERNANCE_PATTERN regex:
       |       if match: checkGovernanceAction(taskId, match[1])
       |                 -> may send governance:approval-needed event
       |
       +-- TOOL EXTRACTION
       |     For each TOOL_PATTERN regex:
       |       if match: logToolCall(taskId, { tool, args, filesAffected })
       |                 -> persists to task.toolLog
       |                 -> pushes task:tool-logged event to renderer
       |
       +-- COMPLETION CHECK
       |     For each COMPLETION_PATTERN regex:
       |       if match: updateTask({ status: 'needs-review' })
       |                 emitStatusChange('needs-review', false)
       |                 stopParsing(taskId)
       |                 RETURN (no further checks)
       |
       +-- ERROR CHECK
       |     For each ERROR_PATTERN regex:
       |       if match: updateTask({ status: 'error' })
       |                 emitStatusChange('error', false)
       |                 RETURN
       |
       +-- NEEDS-INPUT CHECK
             For each NEEDS_INPUT_PATTERN regex:
               if match: updateTask({ needsInput: true })
                         emitStatusChange('running', true)

  IDLE TIMER (parallel, every 5 seconds)
       |
       +-- if (Date.now() - lastOutputTime > 30000) && task.status === 'running':
               emitStatusChange('running', true)  // probably waiting for input
```

---

## 11. Governance System

The governance system provides human-in-the-loop oversight for potentially destructive AI agent
actions.

```
Agent terminal output arrives
       |
       v
  output-parser.ts: check GOVERNANCE_PATTERNS
  e.g. /\$\s+(git\s+push)/i matches "$ git push origin main"
       |
       v
  checkGovernanceAction(taskId, "git push origin main")
       |
       v
  Does action match any requireApprovalFor pattern?
  e.g. "git push" is in DEFAULT_PERMISSIONS.requireApprovalFor
       |
       Yes
       v
  win.webContents.send('governance:approval-needed',
    taskId, action, 'Agent wants to execute: git push origin main')
       |
       v  (push event reaches renderer)
  GovernanceModal component receives event via onGovernanceApprovalNeeded
  Modal renders: action text, Approve / Deny buttons
       |
       +---[User clicks Approve]
       |         |
       |         v
       |   window.bigide.governanceRespond(taskId, true)
       |   Main: handleGovernanceResponse(taskId, true)
       |   No PTY interrupt — agent continues naturally
       |
       +---[User clicks Deny]
                 |
                 v
           window.bigide.governanceRespond(taskId, false)
           Main: handleGovernanceResponse(taskId, false)
           writeToPty(task.ptyId, '\x03')  // Ctrl+C
           Agent receives SIGINT, cancels the push
```

Both approval and denial are recorded in the tool log via `logToolCall` with `tool: 'governance'`,
providing an audit trail.

---

## 12. Component Hierarchy

```
App.tsx
  |
  +-- NotificationBar          (top bar — shows recent notifications from ring buffer)
  |
  +-- ErrorBoundary            (catch-all for React render errors)
  |     |
  |     +-- [no project focused] CanvasView
  |     |       |
  |     |       +-- ReactFlow (node graph)
  |     |             |
  |     |             +-- ProjectNode    (one per project)
  |     |             +-- TaskNode       (one per task, child of ProjectNode)
  |     |
  |     +-- [project focused] ProjectView
  |           |
  |           +-- Sidebar                (project list, task create button)
  |           |
  |           +-- PanelLayout            (resizable split panel container)
  |                 |
  |                 +-- TaskBoard        (Kanban columns: todo/running/needs-review/done)
  |                 |     |
  |                 |     +-- TaskCard   (per task, shows status, last output line)
  |                 |
  |                 +-- TerminalTabs     (one tab per running agent)
  |                 |     |
  |                 |     +-- TerminalPanel  (wraps xterm.js instance)
  |                 |
  |                 +-- DiffPanel        (react-diff-view of task's branch diff)
  |                 |
  |                 +-- ToolLogPanel     (timeline of tool calls)
  |                 |
  |                 +-- AgentSummaryPanel (Markdown summary of agent activity)
  |                 |
  |                 +-- BrowserPanel     (iframe backed by local HTTP file server)
  |
  +-- GovernanceModal          (full-screen overlay when approval is needed)
```

---

## 13. State Management with Zustand

Zustand is a state management library. If you have used Redux, think of Zustand as Redux without
boilerplate — no actions, no reducers, just a JavaScript object with functions that call `set`.
If you have not used Redux, think of it as a global struct with built-in change notifications.

BigIDE has four Zustand stores:

### workspace-store.ts

Holds the list of projects and which project is currently focused (shown in ProjectView).

```typescript
// src/renderer/stores/workspace-store.ts
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  projects: [],
  focusedProjectId: null,

  loadProjects: async () => {
    const projects = await window.bigide.projectList()
    set({ projects: projects as Project[] })
  },

  addProject: async () => {
    const dirPath = await window.bigide.projectSelectDirectory()
    if (!dirPath) return
    const project = await window.bigide.projectAdd({ name, rootPath: dirPath, defaultBranch: 'main' })
    set((state) => ({ projects: [...state.projects, project as Project] }))
  },
  // ...
}))
```

Components subscribe like this:

```typescript
// In a component
const projects = useWorkspaceStore(s => s.projects)
const loadProjects = useWorkspaceStore(s => s.loadProjects)
```

Only the specific selected slice re-renders when it changes — analogous to a fine-grained
observable. The `s =>` function is a selector.

### task-store.ts

Holds tasks keyed by projectId: `Record<string, AgentTask[]>`. Also subscribes to the
`task:status-changed` push event in the store constructor so status updates from the output
parser arrive without any component polling:

```typescript
// src/renderer/stores/task-store.ts
export const useTaskStore = create<TaskState>((set, get) => {
  // Subscribe to push event at store creation time
  if (typeof window !== 'undefined' && window.bigide) {
    window.bigide.onTaskStatusChanged((taskId, status, needsInput) => {
      get()._updateTaskStatus(taskId, status as TaskStatus, needsInput)
    })
  }
  return { tasks: {}, ... }
})
```

### governance-store.ts

Tracks the pending governance approval request (if any) and exposes `approve`/`deny` actions.

### notification-store.ts

Accumulates notifications received via the `notification:new` push event. Provides `markRead`
and `clearAll` actions.

---

## 14. Security Model

BigIDE follows Electron's recommended security practices:

| Setting | Value | Why |
|---|---|---|
| `contextIsolation` | `true` | Renderer JS cannot access Node.js globals or the preload's own scope |
| `nodeIntegration` | `false` | `require()` is not available in renderer code |
| `sandbox` | `false` | Preload needs limited Node access for `contextBridge` to work |
| External links | Opened in system browser | `setWindowOpenHandler` returns `{ action: 'deny' }` |

The trust boundary is the preload script. The renderer is treated as untrusted code (equivalent
to a web page). All privileged operations are gated by the explicit API surface defined in
`contextBridge.exposeInMainWorld('bigide', { ... })`. There is no way for renderer code to call
any Node.js API that is not listed there.

The governance system provides a second layer: even privileged operations that the main process
is technically capable of performing (like `git push`) can be configured to require explicit human
confirmation before the agent's command is allowed to proceed.

---

## 15. External Dependencies

### node-pty (^1.0.0)

A native C++ add-on that wraps the OS pseudo-terminal API. On Unix it calls `forkpty(3)`. On
Windows it uses ConPTY introduced in Windows 10 1903. Because it is native code, it must be
compiled for the specific Electron version using `@electron/rebuild`. The `postinstall` script in
`package.json` runs this rebuild automatically.

Required build tools:
- Windows: Visual Studio Build Tools or Visual C++ Redistributable, Python 3
- Linux/macOS: GCC/Clang, Python 3, `make`

### simple-git (^3.27.0)

A Node.js wrapper around the `git` CLI. It spawns `git` as a child process and parses stdout.
Requires Git to be installed on the system PATH.

### octokit (^4.1.2)

GitHub's official REST and GraphQL API client for Node.js. Used only in `createPullRequest` to
call `octokit.rest.pulls.create`. Authentication via `GITHUB_TOKEN` env var or `gh auth token`.

### @xterm/xterm (^5.5.0)

A terminal emulator written in TypeScript that renders in a `<canvas>` element in the browser.
It handles ANSI/VT100 escape sequences, colour, bold, cursor movement, and scroll. It is used in
`TerminalPanel` to display live PTY output. Addons used:
- `@xterm/addon-fit` — resizes the terminal to fill its container
- `@xterm/addon-web-links` — makes URLs in terminal output clickable

### @xyflow/react (^12.6.0)

React Flow — a library for building interactive node-based editors and graph UIs. Used in
`CanvasView` to display projects and tasks as draggable, connectable nodes. Canvas positions are
persisted to the store so the layout is remembered across restarts.

### react-diff-view (^3.2.1) + unidiff (^1.0.4)

`unidiff` parses unified diff text (the output of `git diff`) into a structured AST. `react-
diff-view` renders that AST as a side-by-side or unified diff with syntax highlighting. Used in
`DiffPanel`.

### electron-store (^8.2.0)

JSON file storage backed by the OS app-data directory. Handles atomic writes, schema validation,
and type safety. Used as BigIDE's only persistence layer — there is no database.

### zustand (^5.0.3)

Lightweight state management. ~1 KB minified. No provider wrappers required — stores are
module-level singletons. Used in place of React Context or Redux.

### TailwindCSS (^4.1.3)

Utility-first CSS framework. All styles are inline class names like `flex`, `text-gray-100`,
`bg-[#0f0f13]`. No component-scoped CSS files. TailwindCSS v4 is integrated as a Vite plugin.

---

## 16. Directory Structure

```
bigide/
  src/
    main/                       <- Node.js main process
      index.ts                  <- App bootstrap, BrowserWindow creation
      ipc-handlers.ts           <- All ipcMain.handle registrations (24 channels total)
      pty-manager.ts            <- node-pty wrapper, ptyId → IPty map
      agent-launcher.ts         <- Spawns AI agents, model → command mapping
      git-service.ts            <- simple-git + Octokit operations
      output-parser.ts          <- Regex-based PTY output analyser
      governance-service.ts     <- Permission checking, approval flow
      tool-log-service.ts       <- ToolLogEntry accumulator + summary generator
      report-service.ts         <- Generates self-contained HTML session reports
      file-server.ts            <- Local HTTP server for Browser panel preview
      notification-service.ts   <- In-memory ring buffer (last 100 notifications)
      store.ts                  <- electron-store wrapper (JSON persistence)

    preload/
      index.ts                  <- contextBridge API surface (the security boundary)

    renderer/                   <- Chromium renderer process
      main.tsx                  <- React root, mounts <App />
      App.tsx                   <- Root component, view routing
      app.css                   <- Base styles
      styles.css                <- Additional global styles
      index.html                <- Electron loads this file
      components/
        canvas/
          CanvasView.tsx        <- React Flow canvas, project/task nodes
          ProjectNode.tsx       <- Node type for projects
          TaskNode.tsx          <- Node type for tasks
        ProjectView.tsx         <- Main IDE layout (panels)
        Sidebar.tsx             <- Project list
        PanelLayout.tsx         <- Resizable panel container
        TaskBoard.tsx           <- Kanban board
        TaskCard.tsx            <- Individual task display
        TaskCreateModal.tsx     <- New task form
        TerminalPanel.tsx       <- xterm.js integration
        TerminalTabs.tsx        <- Tab bar for multiple terminals
        DiffPanel.tsx           <- react-diff-view integration
        ToolLogPanel.tsx        <- Tool call timeline
        AgentSummaryPanel.tsx   <- Markdown summary panel
        BrowserPanel.tsx        <- Embedded iframe browser (local HTTP file server)
        GovernanceModal.tsx     <- Approval / denial overlay
        NotificationBar.tsx     <- Top notification strip
        ErrorBoundary.tsx       <- React error catch boundary
      stores/
        workspace-store.ts      <- Projects + focused project
        task-store.ts           <- Tasks by project, IPC subscriptions
        governance-store.ts     <- Pending approval state
        notification-store.ts   <- Notification list
      hooks/
        useIpc.ts               <- Generic IPC hook utilities
        useTerminal.ts          <- xterm.js lifecycle hook
        useKeyboardShortcuts.ts <- Global keyboard bindings
        useNotifications.ts     <- Notification subscription hook
      lib/
        types.ts                <- Renderer-local type helpers

    shared/
      types.ts                  <- Shared TypeScript interfaces (Project, AgentTask, etc.)
                                   Imported by both main and renderer

  electron.vite.config.ts       <- electron-vite build config (main + preload + renderer)
  electron-builder.yml          <- Distribution packaging config
  tsconfig.json                 <- TypeScript compiler options
  package.json                  <- Dependencies and scripts
  docs/
    ARCHITECTURE.md             <- This document
```

---

## Appendix: Key Design Decisions

**Why worktrees instead of branches only?**
A Git branch without a worktree still shares the working directory with whatever is currently
checked out. Worktrees give each agent its own directory on disk, so multiple agents can work in
parallel without interfering with each other or with the developer's current work.

**Why PTYs instead of child_process.spawn?**
AI agent CLIs are interactive programs that check whether their stdin is a TTY. If stdin is not a
TTY (as it would be with a pipe), many CLIs disable interactive prompts, colour output, and
progress indicators. Using a PTY makes the agent behave exactly as it would when a human is
typing in a terminal.

**Why heuristic regex parsing instead of structured agent output?**
BigIDE supports multiple agents (claude-code, codex, copilot) with different output formats. A
lowest-common-denominator approach based on regex patterns works across all of them without
requiring per-agent integration code. The trade-off is occasional false positives/negatives in
status detection.

**Why electron-store instead of SQLite?**
The data volume is small (a few dozen projects and tasks), relational queries are not needed, and
electron-store requires zero setup or migration tooling. For a prototype this is the right choice;
a production system would likely want SQLite for better query capabilities and concurrency.

**Why Zustand instead of Redux or React Context?**
Zustand has virtually no boilerplate, stores are plain TypeScript objects, and the selector-based
subscription model means components only re-render when the specific slice they care about
changes. For an IDE with many independent panels, avoiding unnecessary re-renders matters.
