# BigIDE Internal IPC API Reference

## Table of Contents

- [Introduction](#introduction)
  - [What is IPC?](#what-is-ipc)
  - [The Preload Bridge](#the-preload-bridge)
  - [Using the API](#using-the-api)
- [Project API](#project-api)
  - [projectList](#projectlist)
  - [projectAdd](#projectadd)
  - [projectRemove](#projectremove)
  - [projectUpdateCanvasPosition](#projectupdatecanvasposition)
  - [projectSelectDirectory](#projectselectdirectory)
- [Task API](#task-api)
  - [taskList](#tasklist)
  - [taskCreate](#taskcreate)
  - [taskStart](#taskstart)
  - [taskStop](#taskstop)
  - [taskSendInput](#tasksendinput)
  - [taskGetDiff](#taskgetdiff)
  - [taskUpdateStatus](#taskupdatestatus)
  - [taskCleanup](#taskcleanup)
  - [taskGetToolLog](#taskgettoollog)
  - [taskGetSummary](#taskgetsummary)
  - [taskCreatePr](#taskcreatepr)
  - [taskGenerateReport](#taskgeneratereport)
- [Terminal API](#terminal-api)
  - [terminalResize](#terminalresize)
  - [terminalWrite](#terminalwrite)
- [Preview API](#preview-api)
  - [previewServe](#previewserve)
  - [previewStop](#previewstop)
- [Git API](#git-api)
  - [gitWorktreeList](#gitworktreelist)
  - [gitMergeBranch](#gitmergebranch)
- [Governance API](#governance-api)
  - [taskCheckPermission](#taskcheckpermission)
  - [governanceRespond](#governancerespond)
- [Event Subscriptions](#event-subscriptions)
  - [onTerminalData](#onterminaldata)
  - [onTaskStatusChanged](#ontaskstatuschanged)
  - [onTaskToolLogged](#ontasktoollogged)
  - [onGovernanceApprovalNeeded](#ongovernanceapprovalneeded)
  - [onNotification](#onnotification)
- [Data Types Reference](#data-types-reference)
- [Error Handling](#error-handling)
- [Architecture Notes](#architecture-notes)

---

## Introduction

### What is IPC?

Electron applications run in two distinct processes:

- **Main process** — a Node.js process with full system access (filesystem, native APIs, spawning subprocesses, etc.)
- **Renderer process** — a Chromium process that runs the UI (React in BigIDE's case)

These processes cannot call each other's code directly. Instead they communicate over **Inter-Process Communication (IPC)** channels. The renderer sends a named message to the main process, waits for a response, and the main process handles it and replies.

BigIDE uses Electron's `ipcMain.handle` / `ipcRenderer.invoke` pattern for request/response calls, and `webContents.send` / `ipcRenderer.on` for push events from main to renderer.

```
Renderer (React)          Preload Bridge          Main Process
      │                         │                       │
      │  window.bigide.foo()    │                       │
      │────────────────────────>│                       │
      │                         │  ipcRenderer.invoke   │
      │                         │  ('channel:name', …)  │
      │                         │──────────────────────>│
      │                         │                       │  ipcMain.handle(…)
      │                         │      result           │
      │                         │<──────────────────────│
      │      Promise resolves   │                       │
      │<────────────────────────│                       │
```

### The Preload Bridge

Because the renderer runs in a sandboxed Chromium context, it cannot require Node.js modules directly. Electron's **context bridge** solves this: a preload script (`src/preload/index.ts`) runs in a privileged context and selectively exposes safe wrappers to the renderer via `contextBridge.exposeInMainWorld`.

BigIDE exposes its entire API surface as `window.bigide`:

```typescript
// src/preload/index.ts
contextBridge.exposeInMainWorld('bigide', api)
```

The TypeScript type for the full API is exported as `BigIdeApi`:

```typescript
export type BigIdeApi = typeof api
```

On the main process side, `src/main/ipc-handlers.ts` registers handlers for every channel using `ipcMain.handle(channelName, handler)`. These are registered once at startup in `registerIpcHandlers()`.

### Using the API

**Direct call from a component:**

```typescript
const projects = await window.bigide.projectList()
```

**Using the `useIpc` hook (recommended):**

The `useIpc` hook (`src/renderer/hooks/useIpc.ts`) wraps calls with a consistent error boundary so components do not need repetitive try/catch blocks:

```typescript
import { useIpc } from '../hooks/useIpc'

function MyComponent() {
  const { invoke, api } = useIpc()

  const loadProjects = async () => {
    // Falls back to [] if the IPC call throws
    const projects = await invoke(() => api.projectList(), [])
  }
}
```

**Subscribing to push events:**

All `on*` methods return an unsubscribe function. Call it in a cleanup effect:

```typescript
useEffect(() => {
  const unsub = window.bigide.onTaskStatusChanged((taskId, status, needsInput) => {
    // handle update
  })
  return unsub // called on unmount
}, [])
```

---

## Project API

### projectList

**Channel:** `project:list`
**Parameters:** none
**Returns:** `Promise<Project[]>`

Returns all projects from the persistent `electron-store` store. Projects survive application restarts.

**Example:**

```typescript
const projects = await window.bigide.projectList()
// [{ id: 'uuid', name: 'my-app', rootPath: '/home/user/my-app', ... }]
```

**Source:** `src/main/ipc-handlers.ts:17`, `src/main/store.ts:17`

---

### projectAdd

**Channel:** `project:add`
**Parameters:**
- `project: Omit<Project, 'id' | 'canvasPosition'>` — project data without `id` or `canvasPosition` (both are auto-generated)

**Returns:** `Promise<Project>`

Creates a new project entry. The main process assigns a UUID via `crypto.randomUUID()` and generates a random initial canvas position (`x` between 100–700, `y` between 100–500).

**Example:**

```typescript
const project = await window.bigide.projectAdd({
  name: 'my-app',
  rootPath: '/home/user/my-app',
  defaultBranch: 'main',
  githubRepo: 'myorg/my-app',   // optional — required for PR creation
  browserUrl: 'http://localhost:3000'  // optional
})
console.log(project.id) // auto-generated UUID
```

**Source:** `src/main/ipc-handlers.ts:19–27`

---

### projectRemove

**Channel:** `project:remove`
**Parameters:**
- `id: string` — project UUID

**Returns:** `Promise<void>`

Removes the project and **all tasks belonging to it** from the persistent store. This is a cascade delete at the store level. Running PTY processes or worktrees for those tasks are not automatically cleaned up — call `taskCleanup` for each task first if needed.

**Example:**

```typescript
await window.bigide.projectRemove(project.id)
```

**Source:** `src/main/ipc-handlers.ts:29–31`, `src/main/store.ts:52–55`

---

### projectUpdateCanvasPosition

**Channel:** `project:update-canvas-position`
**Parameters:**
- `id: string` — project UUID
- `position: { x: number; y: number }` — new canvas coordinates in pixels

**Returns:** `Promise<void>`

Updates the drag-and-drop position of the project node on the canvas view. Called continuously as a user drags a node. Persists the final position to the store.

**Example:**

```typescript
// Called from drag handlers in CanvasView
await window.bigide.projectUpdateCanvasPosition(project.id, { x: 320, y: 210 })
```

**Source:** `src/main/ipc-handlers.ts:33–41`

---

### projectSelectDirectory

**Channel:** `project:select-directory`
**Parameters:** none
**Returns:** `Promise<string | null>`

Opens the native OS folder picker dialog (via Electron's `dialog.showOpenDialog`). Returns the selected absolute path, or `null` if the user cancelled without choosing a folder.

**Example:**

```typescript
const path = await window.bigide.projectSelectDirectory()
if (path) {
  // user selected /home/user/my-app
}
```

**Source:** `src/main/ipc-handlers.ts:42–49`

---

## Task API

### taskList

**Channel:** `task:list`
**Parameters:**
- `projectId: string` — project UUID

**Returns:** `Promise<AgentTask[]>`

Returns all tasks associated with the given project, read from the persistent store.

**Example:**

```typescript
const tasks = await window.bigide.taskList(project.id)
```

**Source:** `src/main/ipc-handlers.ts:53`

---

### taskCreate

**Channel:** `task:create`
**Parameters:**
- `task` object with the following fields:
  - `projectId: string`
  - `title: string`
  - `prompt: string`
  - `branchName: string` — Git branch that will be created for this task
  - `model: string` — agent model key (`'gemini-cli'` (default), `'claude-code'`, `'codex'`, `'copilot'`, `'custom'`)
  - `permissions: TaskPermissions`
  - `status: TaskStatus`

**Returns:** `Promise<AgentTask>`

Creates a task record and immediately attempts to create a **Git worktree** for it. The worktree is created at `<repoPath>/../.bigide-worktrees/<branchName>`, branching off the project's `defaultBranch`. If worktree creation fails (e.g., the branch already exists), the error is logged and the task is still persisted — `worktreePath` will be `null`.

Auto-initialised fields set by the main process:
- `id` — `crypto.randomUUID()`
- `worktreePath` — path to Git worktree, or `null`
- `ptyId` — `null` (set later on `taskStart`)
- `needsInput` — `false`
- `lastOutputLine` — `''`
- `agentSummary` — `null`
- `toolLog` — `[]`
- `diffStats` — `null`
- `prUrl` — `null`

**Example:**

```typescript
const task = await window.bigide.taskCreate({
  projectId: project.id,
  title: 'Add user authentication',
  prompt: 'Implement JWT-based login and registration endpoints',
  branchName: 'feat/auth',
  model: 'gemini-cli',
  status: 'todo',
  permissions: {
    allowFileWrite: true,
    allowBash: true,
    allowNetworkAccess: false,
    allowGitPush: false,
    requireApprovalFor: ['git push', 'rm -rf', 'npm publish', 'deploy']
  }
})
```

**Source:** `src/main/ipc-handlers.ts:55–82`, `src/main/git-service.ts:5–13`

---

### taskStart

**Channel:** `task:start`
**Parameters:**
- `taskId: string` — task UUID

**Returns:** `Promise<void>`

Starts the agent for a task. Internally this:

1. Looks up the task and its parent project.
2. Calls `launchAgent(task, project.rootPath)` which:
   - Creates a PTY (pseudo-terminal) via `node-pty` with `id = "agent-<taskId>"`, working directory set to `task.worktreePath` (falling back to `project.rootPath`).
   - Registers output parsing via `startOutputParsing` which listens to PTY data and emits `task:status-changed`, `task:tool-logged`, and `governance:approval-needed` events automatically.
   - After a 1-second shell initialisation delay, writes the model-specific command to the PTY stdin (e.g., `claude "<prompt>"` for `claude-code`).
3. Updates the task's `status` to `'running'` in the store.

The PTY spawns the user's default shell (`$SHELL` on Unix, `%COMSPEC%` or `powershell.exe` on Windows) in `xterm-256color` mode, 120 columns × 30 rows.

**Example:**

```typescript
await window.bigide.taskStart(task.id)
// PTY is now running, terminal:data events will begin streaming
```

**Source:** `src/main/ipc-handlers.ts:84–90`, `src/main/agent-launcher.ts:16–37`

---

### taskStop

**Channel:** `task:stop`
**Parameters:**
- `taskId: string` — task UUID

**Returns:** `Promise<void>`

Stops a running agent by:

1. Sending `Ctrl+C` (`\x03`) to the PTY stdin to request graceful cancellation.
2. Waiting 500 ms, then calling `killPty` to forcefully terminate the process.
3. Updating the task status to `'error'` with `lastOutputLine: 'Stopped by user'`.

**Example:**

```typescript
await window.bigide.taskStop(task.id)
```

**Source:** `src/main/ipc-handlers.ts:92–97`, `src/main/agent-launcher.ts:39–47`

---

### taskSendInput

**Channel:** `task:send-input`
**Parameters:**
- `taskId: string` — task UUID
- `input: string` — raw string to write to the PTY stdin

**Returns:** `Promise<void>`

Writes arbitrary data directly to the PTY stdin. Used when the agent is waiting for user input (indicated by `needsInput: true` on the task). After sending, `needsInput` is reset to `false` on the task record.

To send a newline (confirm a prompt), include `\r` or `\n` in the string.

**Example:**

```typescript
// Respond "yes" to an agent confirmation prompt
await window.bigide.taskSendInput(task.id, 'yes\r')

// Send a follow-up instruction
await window.bigide.taskSendInput(task.id, 'also add input validation\r')
```

**Source:** `src/main/ipc-handlers.ts:99–101`, `src/main/agent-launcher.ts:49–55`

---

### taskGetDiff

**Channel:** `task:get-diff`
**Parameters:**
- `taskId: string` — task UUID

**Returns:** `Promise<string>`

Returns the unified diff between the project's `defaultBranch` and the task's `branchName`, using a three-dot diff (`git diff <base>...<branch>`). Returns an empty string if the task or project cannot be found, or if git reports no changes.

The diff covers all commits on the task branch that are not on the base branch, making it equivalent to what a pull request would show.

**Example:**

```typescript
const diff = await window.bigide.taskGetDiff(task.id)
// diff: '--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -0,0 +1,42 @@\n+...'
```

**Source:** `src/main/ipc-handlers.ts:103–109`, `src/main/git-service.ts:34–45`

---

### taskUpdateStatus

**Channel:** `task:update-status`
**Parameters:**
- `taskId: string` — task UUID
- `status: TaskStatus` — new status value

**Returns:** `Promise<void>`

Manually sets the task status in the store. Useful for moving tasks through the workflow outside of automatic agent-driven transitions (e.g., marking a reviewed task as `'done'`).

Valid values for `TaskStatus`: `'todo'` | `'running'` | `'needs-review'` | `'done'` | `'error'`

**Example:**

```typescript
// Mark task as done after reviewing the diff
await window.bigide.taskUpdateStatus(task.id, 'done')
```

**Source:** `src/main/ipc-handlers.ts:111–113`

---

### taskCleanup

**Channel:** `task:cleanup`
**Parameters:**
- `taskId: string` — task UUID

**Returns:** `Promise<void>`

Fully tears down a task's runtime resources:

1. If a PTY is still alive (`task.ptyId` is set), kills it immediately.
2. If a worktree exists (`task.worktreePath` is set), removes it from disk with `git worktree remove --force`.
3. Sets the task `status` to `'done'` and clears `ptyId` in the store.

The task record itself remains in the store after cleanup (it is not deleted). Call `projectRemove` or a future `taskDelete` to remove the record entirely.

**Example:**

```typescript
// Called when user dismisses a completed task card
await window.bigide.taskCleanup(task.id)
```

**Source:** `src/main/ipc-handlers.ts:115–124`, `src/main/git-service.ts:16–23`

---

### taskGetToolLog

**Channel:** `task:get-tool-log`
**Parameters:**
- `taskId: string` — task UUID

**Returns:** `Promise<ToolLogEntry[]>`

Returns the structured log of agent tool calls detected during the task's run. Entries are appended in real-time by the output parser as it recognises patterns in the PTY stream. An empty array is returned if the task has no log or does not exist.

Tool types detected: `file_edit`, `file_read`, `bash`, `search`, `web`.

**Example:**

```typescript
const log = await window.bigide.taskGetToolLog(task.id)
// [
//   { timestamp: 1710000000000, tool: 'file_edit', args: 'src/auth.ts',
//     result: 'success', filesAffected: ['src/auth.ts'] },
//   { timestamp: 1710000001000, tool: 'bash', args: 'npm test',
//     result: 'success', filesAffected: [] }
// ]
```

**Source:** `src/main/ipc-handlers.ts:126–128`, `src/main/tool-log-service.ts`

---

### taskGetSummary

**Channel:** `task:get-summary`
**Parameters:**
- `taskId: string` — task UUID

**Returns:** `Promise<string | null>`

Returns the agent-generated plain-text summary of completed work, or `null` if the task is not yet finished or no summary was captured. The summary is extracted from agent output by the output parser and stored on the `AgentTask` record.

This summary is also used as the pull request body when creating a PR via `taskCreatePr`.

**Example:**

```typescript
const summary = await window.bigide.taskGetSummary(task.id)
if (summary) {
  console.log('Agent completed:', summary)
}
```

**Source:** `src/main/ipc-handlers.ts:130–132`

---

### taskCreatePr

**Channel:** `task:create-pr`
**Parameters:**
- `taskId: string` — task UUID

**Returns:** `Promise<string>` — the full HTML URL of the created pull request

Creates a GitHub pull request for a completed task. The process is:

1. Pushes the task branch to the `origin` remote with `git push origin <branchName>`.
2. Resolves a GitHub token, preferring `GITHUB_TOKEN` env var and falling back to `gh auth token` from the GitHub CLI.
3. Creates a PR via the Octokit REST API with:
   - **title:** `task.title`
   - **head:** `task.branchName`
   - **base:** `project.defaultBranch`
   - **body:** agent summary (if available), otherwise the raw prompt
4. Stores the returned PR URL on the task record (`prUrl`).

**Prerequisites:**
- `project.githubRepo` must be set in the format `"owner/repo"` (e.g. `"myorg/my-app"`).
- A GitHub token must be available via `GITHUB_TOKEN` or the `gh` CLI.

**Throws** if no GitHub repo is configured or no auth token is found.

**Example:**

```typescript
try {
  const prUrl = await window.bigide.taskCreatePr(task.id)
  window.open(prUrl) // e.g. https://github.com/myorg/my-app/pull/42
} catch (err) {
  console.error('PR creation failed:', err.message)
}
```

**Source:** `src/main/ipc-handlers.ts:134–142`, `src/main/git-service.ts:74–112`

---

### taskGenerateReport

**Channel:** `task:generate-report`
**Parameters:**
- `taskId: string` — task UUID

**Returns:** `Promise<string>` — absolute path to the generated HTML report file

Generates (or regenerates) a self-contained HTML session report for the task and writes it to `.bigide-reports/` inside the project directory. Opens the report in the system default browser via `shell.openExternal`. The report path is also stored on the task record (`reportPath`).

Reports are auto-generated when a task transitions to `needs-review` or `done`. Calling this handler manually regenerates the report with the latest task data.

**Report contents:** task metadata, start/completed timestamps + duration, original prompt, PR URL, diff stats, full color-coded diff, agent summary, tool log timeline, governance decisions, terminal transcript (ANSI-cleaned, up to 2000 lines).

**Example:**

```typescript
const reportPath = await window.bigide.taskGenerateReport(task.id)
// Report opened in browser automatically
// reportPath: '/home/user/my-project/.bigide-reports/task-abc123.html'
```

**Source:** `src/main/ipc-handlers.ts`, `src/main/report-service.ts`

---

## Terminal API

### terminalResize

**Channel:** `terminal:resize`
**Parameters:**
- `ptyId: string` — PTY identifier (format: `"agent-<taskId>"`)
- `cols: number` — number of terminal columns
- `rows: number` — number of terminal rows

**Returns:** `Promise<void>`

Resizes the PTY process to the given dimensions. Should be called whenever the terminal panel is resized in the UI, so that line-wrapping inside the agent's output matches what the terminal widget renders. Has no effect if the PTY ID is not found.

**Example:**

```typescript
// Called from a ResizeObserver on the terminal panel element
await window.bigide.terminalResize(`agent-${task.id}`, 132, 40)
```

**Source:** `src/main/ipc-handlers.ts:146–148`, `src/main/pty-manager.ts:68–71`

---

### terminalWrite

**Channel:** `terminal:write`
**Parameters:**
- `ptyId: string` — PTY identifier (format: `"agent-<taskId>"`)
- `data: string` — raw string to write directly to the PTY

**Returns:** `Promise<void>`

Writes data directly to the PTY process, bypassing the agent command abstraction. Unlike `taskSendInput`, this channel targets the PTY by its ID rather than a task ID. It is used by the terminal panel's clipboard paste handler and keyboard shortcuts (Ctrl+V, Ctrl+A) so that terminal input continues to work even after an agent process has stopped.

This channel is the reason terminal keyboard interaction survives agent completion — the PTY (the shell) outlives the agent subprocess that ran inside it.

**Example:**

```typescript
// Paste clipboard content into terminal
await window.bigide.terminalWrite(`agent-${task.id}`, clipboardText)

// Send select-all sequence
await window.bigide.terminalWrite(`agent-${task.id}`, '\x01')
```

**Source:** `src/main/ipc-handlers.ts`, `src/main/pty-manager.ts`

---

## Preview API

### previewServe

**Channel:** `preview:serve`
**Parameters:**
- `taskId: string` — task UUID

**Returns:** `Promise<number>` — the localhost port number the file server is listening on

Starts a local HTTP file server (`file-server.ts`) that serves the task's worktree directory on a random available port. If the worktree has no `index.html`, the server falls back to serving the project root. Used by the Browser panel's "Preview" button to display the agent's output in the embedded iframe.

CORS headers are set and path traversal is prevented. Supports MIME types for HTML, CSS, JS, JSON, images, fonts, and SVG.

**Example:**

```typescript
const port = await window.bigide.previewServe(task.id)
// iframe src set to `http://localhost:${port}/`
```

**Source:** `src/main/ipc-handlers.ts`, `src/main/file-server.ts`

---

### previewStop

**Channel:** `preview:stop`
**Parameters:**
- `taskId: string` — task UUID

**Returns:** `Promise<void>`

Stops the local HTTP file server that was started by `previewServe` for this task. Called when the user navigates away from the Browser panel or when a task is cleaned up.

**Example:**

```typescript
await window.bigide.previewStop(task.id)
```

**Source:** `src/main/ipc-handlers.ts`, `src/main/file-server.ts`

---

## Git API

### gitWorktreeList

**Channel:** `git:worktree-list`
**Parameters:**
- `projectId: string` — project UUID

**Returns:** `Promise<string[]>`

Lists the absolute paths of all Git worktrees registered for the project's repository. Uses `git worktree list --porcelain` and parses out the `worktree` lines. Returns an empty array if the project is not found.

Note: the parameter is a `projectId`, not a raw path. The handler resolves the project's `rootPath` from the store.

**Example:**

```typescript
const worktrees = await window.bigide.gitWorktreeList(project.id)
// ['/home/user/my-app', '/home/user/.bigide-worktrees/feat/auth']
```

**Source:** `src/main/ipc-handlers.ts:152–156`, `src/main/git-service.ts:25–32`

---

### gitMergeBranch

**Channel:** `git:merge-branch`
**Parameters:**
- `projectId: string` — project UUID
- `branchName: string` — name of the branch to merge into the current branch

**Returns:** `Promise<void>`

Merges the specified branch into whichever branch is currently checked out in the project's root repository (not in a worktree). This is a standard `git merge <branchName>` call — it does not push. Throws if the project is not found or if git reports a merge conflict.

**Example:**

```typescript
// Merge a task's branch into main after review
await window.bigide.gitMergeBranch(project.id, task.branchName)
```

**Source:** `src/main/ipc-handlers.ts:158–162`, `src/main/git-service.ts:69–72`

---

## Governance API

### taskCheckPermission

**Channel:** `task:check-permission`
**Parameters:**
- `taskId: string` — task UUID
- `action: string` — action string to check (e.g. `'bash:npm publish'`, `'git push'`)

**Returns:** `Promise<boolean>` — `true` if the action is permitted, `false` if blocked

Evaluates whether a given action is allowed under the task's current `TaskPermissions`. The check logic:

1. Actions starting with `"file"` are blocked if `allowFileWrite` is `false`.
2. Actions starting with `"bash"` are blocked if `allowBash` is `false`.
3. Actions containing `"network"` are blocked if `allowNetworkAccess` is `false`.
4. Actions containing `"git push"` are blocked if `allowGitPush` is `false`.
5. Returns `false` if the action matches any pattern in `requireApprovalFor` (case-insensitive substring match).

Returns `false` if the task is not found.

**Example:**

```typescript
const allowed = await window.bigide.taskCheckPermission(task.id, 'git push origin main')
if (!allowed) {
  console.log('Action blocked by governance rules')
}
```

**Source:** `src/main/ipc-handlers.ts:166–168`, `src/main/governance-service.ts:13–29`

---

### governanceRespond

**Channel:** `governance:respond`
**Parameters:**
- `taskId: string` — task UUID
- `approved: boolean` — `true` to allow the pending action, `false` to deny it

**Returns:** `Promise<void>`

Responds to a pending governance approval request that was signalled by the `governance:approval-needed` event. The response is logged as a `ToolLogEntry` with tool name `"governance"`. If the action is denied, `Ctrl+C` is sent to the task's PTY to interrupt the agent.

**Example:**

```typescript
// Called when user clicks Approve or Deny in the GovernanceModal
await window.bigide.governanceRespond(task.id, true)   // approve
await window.bigide.governanceRespond(task.id, false)  // deny
```

**Source:** `src/main/ipc-handlers.ts:170–172`, `src/main/governance-service.ts:58–75`

---

## Event Subscriptions

These are **push events** sent from the main process to the renderer using `webContents.send`. They are not request/response — the main process fires them whenever relevant state changes occur.

All `on*` methods return an **unsubscribe function**. Always call it in a React cleanup effect to prevent memory leaks and stale handlers.

```typescript
useEffect(() => {
  const unsub = window.bigide.onSomeEvent((arg) => { ... })
  return unsub
}, [])
```

---

### onTerminalData

**Channel:** `terminal:data`
**Callback:** `(ptyId: string, data: string) => void`

Fired every time the PTY produces output. The `data` string contains raw terminal escape sequences (ANSI codes for colour, cursor movement, etc.) and should be fed directly to an `xterm.js` terminal instance. Both the output parser and the `TerminalPanel` component attach listeners for this event.

**Example:**

```typescript
useEffect(() => {
  return window.bigide.onTerminalData((ptyId, data) => {
    if (ptyId === `agent-${taskId}`) {
      terminalRef.current?.write(data)
    }
  })
}, [taskId])
```

**Source:** `src/preload/index.ts:43–47`, `src/main/pty-manager.ts:40–44`

---

### onTaskStatusChanged

**Channel:** `task:status-changed`
**Callback:** `(taskId: string, status: TaskStatus, needsInput: boolean) => void`

Fired when the output parser detects a status transition in agent output, or when `taskStop` is called. The `needsInput` flag indicates whether the agent is waiting for user input (e.g., it printed a `?` prompt or has been idle for 30+ seconds).

Status transitions triggered by the output parser:
- Matches a completion pattern → `'needs-review'`, `needsInput: false`
- Matches an error pattern → `'error'`, `needsInput: false`
- Matches an input-needed pattern or idle timeout → `'running'`, `needsInput: true`

**Example:**

```typescript
useEffect(() => {
  return window.bigide.onTaskStatusChanged((taskId, status, needsInput) => {
    updateTaskInStore(taskId, { status, needsInput })
  })
}, [])
```

**Source:** `src/preload/index.ts:48–53`, `src/main/output-parser.ts:163–168`

---

### onTaskToolLogged

**Channel:** `task:tool-logged`
**Callback:** `(taskId: string, entry: ToolLogEntry) => void`

Fired in real-time as the output parser detects tool-use patterns in the agent's PTY output. The `entry` contains the tool name, arguments, result, and any affected file paths. These events power the live tool activity display in `ToolLogPanel`.

**Example:**

```typescript
useEffect(() => {
  return window.bigide.onTaskToolLogged((taskId, entry) => {
    if (taskId === currentTaskId) {
      appendToToolLog(entry)
    }
  })
}, [currentTaskId])
```

**Source:** `src/preload/index.ts:54–58`, `src/main/output-parser.ts:119–131`

---

### onGovernanceApprovalNeeded

**Channel:** `governance:approval-needed`
**Callback:** `(taskId: string, action: string, detail: string) => void`

Fired when the output parser detects a governance-sensitive command in the agent's output (e.g., `git push`, `rm -rf`, `npm publish`, `deploy`). The renderer should surface an approval dialog to the user. The action remains pending until `governanceRespond` is called.

`detail` is a human-readable description of the action (e.g., `"Agent wants to execute: git push"`).

**Example:**

```typescript
useEffect(() => {
  return window.bigide.onGovernanceApprovalNeeded((taskId, action, detail) => {
    showApprovalModal({ taskId, action, detail })
  })
}, [])
```

**Source:** `src/preload/index.ts:59–64`, `src/main/governance-service.ts:31–55`

---

### onNotification

**Channel:** `notification:new`
**Callback:** `(notification: Notification) => void`

Fired when the notification service creates a new in-app notification. Consumers should append the notification to their notification list. The `NotificationBar` component and `notification-store` consume this event.

**Example:**

```typescript
useEffect(() => {
  return window.bigide.onNotification((notification) => {
    notificationStore.add(notification)
  })
}, [])
```

**Source:** `src/preload/index.ts:65–69`, `src/main/notification-service.ts`

---

## Data Types Reference

All types are defined in `src/shared/types.ts` and imported in both main and renderer processes.

### Project

```typescript
interface Project {
  id: string                          // UUID, auto-generated on projectAdd
  name: string                        // Display name
  rootPath: string                    // Absolute path to the git repository root
  defaultBranch: string               // Branch new tasks branch off (e.g. 'main')
  browserUrl?: string                 // Optional URL to open in the browser panel
  githubRepo?: string                 // 'owner/repo' — required for PR creation
  canvasPosition: { x: number; y: number }  // Position on the canvas view
}
```

---

### AgentTask

```typescript
interface AgentTask {
  id: string                   // UUID, auto-generated on taskCreate
  projectId: string            // Parent project UUID
  title: string                // Short display title
  prompt: string               // Full instruction passed to the agent
  status: TaskStatus           // Current lifecycle state
  branchName: string           // Git branch name for this task
  worktreePath: string | null  // Absolute path to git worktree, null if creation failed
  ptyId: string | null         // PTY identifier ('agent-<id>'), null until taskStart
  needsInput: boolean          // True when agent is waiting for user input
  lastOutputLine: string       // Most recent non-empty output line (max 200 chars)
  model: string                // Agent model key (see supported values below)
  agentSummary: string | null  // Agent-generated summary of completed work
  toolLog: ToolLogEntry[]      // Structured history of tool calls
  diffStats: {                 // Summary of code changes, null until populated
    filesChanged: number
    insertions: number
    deletions: number
  } | null
  permissions: TaskPermissions // Governance rules for this task
  prUrl: string | null         // GitHub PR URL, set after taskCreatePr
  terminalLog: string[]        // ANSI-cleaned output lines, capped at 2000
  startedAt: number | null     // Unix ms timestamp when task moved to 'running'
  completedAt: number | null   // Unix ms timestamp when task moved to 'needs-review' or 'done'
  reportPath: string | null    // Absolute path to the latest generated HTML report
}
```

**Supported `model` values:**

| Value | Command template | Notes |
|---|---|---|
| `'gemini-cli'` | `gemini -i "<prompt>"` | **Default model** — interactive mode, no `-m` flag |
| `'claude-code'` | `claude "<prompt>"` | |
| `'codex'` | `codex "<prompt>"` | |
| `'copilot'` | `gh copilot suggest "<prompt>"` | |
| `'custom'` | Placeholder comment (user pastes their own command) | |

---

### TaskStatus

```typescript
type TaskStatus = 'todo' | 'running' | 'needs-review' | 'done' | 'error'
```

| Value | Meaning |
|---|---|
| `'todo'` | Created, not yet started |
| `'running'` | Agent is actively executing |
| `'needs-review'` | Agent completed; awaiting human review |
| `'done'` | Reviewed and accepted |
| `'error'` | Agent encountered an error or was stopped |

---

### ToolLogEntry

```typescript
interface ToolLogEntry {
  timestamp: number            // Unix milliseconds (Date.now())
  tool: string                 // Tool category: 'file_edit' | 'file_read' | 'bash' | 'search' | 'web' | 'governance'
  args: string                 // Arguments or description of the call
  result: 'success' | 'error' // Outcome
  filesAffected: string[]      // List of file paths touched by the call
}
```

---

### TaskPermissions

```typescript
interface TaskPermissions {
  allowFileWrite: boolean        // Allow agent to create/modify files
  allowBash: boolean             // Allow agent to run shell commands
  allowNetworkAccess: boolean    // Allow agent to make network requests
  allowGitPush: boolean          // Allow agent to push to remote
  requireApprovalFor: string[]   // Action substrings that trigger approval prompt
}
```

**Default permissions** (exported as `DEFAULT_PERMISSIONS`):

```typescript
const DEFAULT_PERMISSIONS: TaskPermissions = {
  allowFileWrite: true,
  allowBash: true,
  allowNetworkAccess: false,
  allowGitPush: false,
  requireApprovalFor: ['git push', 'rm -rf', 'npm publish', 'deploy']
}
```

---

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

## Error Handling

### How errors propagate

All `ipcMain.handle` handlers are wrapped by Electron's IPC machinery. If a handler throws, the error is serialised and re-thrown in the renderer when the corresponding `ipcRenderer.invoke` promise rejects.

```typescript
// Main process throws:
ipcMain.handle('task:create-pr', async (_, taskId) => {
  throw new Error('No GitHub repo configured')
})

// Renderer receives a rejected promise:
await window.bigide.taskCreatePr(taskId)
// UnhandledPromiseRejection: No GitHub repo configured
```

### Recommended pattern: useIpc hook

Use the `useIpc` hook for calls where you want a safe fallback instead of an unhandled rejection:

```typescript
const { invoke, api } = useIpc()

const diff = await invoke(() => api.taskGetDiff(taskId), '')
// Returns '' if the IPC call throws, logs error to console
```

The hook's `invoke` function signature:

```typescript
invoke<T>(fn: () => Promise<T>, fallback: T): Promise<T>
```

### Direct try/catch

For operations where you need to handle the error explicitly (e.g., PR creation, where failure messaging matters):

```typescript
try {
  const prUrl = await window.bigide.taskCreatePr(task.id)
  toast.success(`PR created: ${prUrl}`)
} catch (err: any) {
  toast.error(`Failed to create PR: ${err.message}`)
}
```

### Common error scenarios

| Error message | Cause | Resolution |
|---|---|---|
| `No working directory for task` | `worktreePath` is null and no project `rootPath` available | Ensure the project has a valid `rootPath` and worktree creation succeeded |
| `No GitHub repo configured` | `project.githubRepo` is not set | Add `githubRepo: 'owner/repo'` to the project |
| `No GitHub token found` | Neither `GITHUB_TOKEN` env var nor `gh` CLI is available | Set `GITHUB_TOKEN` or run `gh auth login` |
| `Project not found` | `projectId` passed to a handler does not match any stored project | Verify the project was successfully added and the correct ID is used |
| `Task not found` | `taskId` passed to a handler does not match any stored task | Verify the task exists and the correct ID is used |
| `node-pty not available` | Native module failed to load (common in dev without native rebuild) | Run `npm run rebuild` or `electron-rebuild` |
| Git merge conflict | `gitMergeBranch` called when branches have conflicting changes | Resolve conflicts manually before merging |

---

## Architecture Notes

### Persistent store

Projects and tasks are persisted using `electron-store` (backed by a JSON file in the OS app data directory). The store file is named `bigide-state.json`. PTY IDs and worktree paths are runtime state that becomes stale after the app restarts — `ptyId` on tasks should be treated as unreliable across sessions.

### Worktree layout

Each task gets an isolated Git worktree. Worktrees are created at:

```
<projectRootPath>/../.bigide-worktrees/<branchName>
```

For example, if `rootPath` is `/home/user/my-app` and `branchName` is `feat/auth`, the worktree lands at `/home/user/.bigide-worktrees/feat/auth`. The agent runs inside this directory, keeping its changes isolated from the main checkout.

### PTY lifecycle

PTY IDs follow the format `"agent-<taskId>"`. The lifecycle is:

```
taskCreate  →  (ptyId: null)
taskStart   →  createPty('agent-<id>', worktreePath)  →  ptyId set
taskStop    →  Ctrl+C → 500ms delay → killPty
taskCleanup →  killPty (if still alive) + removeWorktree
```

### Output parsing

The output parser (`src/main/output-parser.ts`) attaches a `data` listener directly to the `node-pty` process object. It maintains a rolling 10 KB buffer per task and applies regex patterns to detect:

- **Needs-input:** prompt characters (`>`, `❯`), question marks, `(y/n)`, `"press enter"`, `"waiting for input"`
- **Completion:** checkmarks with "completed", `"successfully created/updated/fixed"`, all tests passed, `"done"`
- **Error:** `"error:"`, `"fatal:"`, `"panic:"`, cross marks, stack traces
- **Tool calls:** file edits, file reads, bash commands (`$ …`), search operations, web fetches
- **Governance:** `git push`, `rm -rf`, `npm publish`, `deploy` in bash command output

An idle timer fires every 5 seconds and sets `needsInput: true` if the agent has produced no output for 30+ seconds.
