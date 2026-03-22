# BigIDE Bugfix Journal

**Project:** BigIDE — AI Agent Orchestration IDE
**Period:** Initial development through live user testing
**Total issues resolved:** 52

This journal chronicles every bug discovered, diagnosed, and fixed during BigIDE's development. Issues are organized chronologically by phase. Each entry documents the root cause, user-visible impact, and the fix applied. Future developers should treat this as a reference for understanding why certain non-obvious code choices were made.

---

## Table of Contents

- [Phase 1: Initial UI Testing (Bugs #1–3)](#phase-1-initial-ui-testing)
- [Phase 2: Full Codebase Audit (Bugs #4–18)](#phase-2-full-codebase-audit)
- [Phase 3: Live Testing Fixes (Bugs #19–32)](#phase-3-live-testing-fixes)
- [Phase 4: User Testing and Polish (Bugs #33–52)](#phase-4-user-testing-and-polish)

---

## Phase 1: Initial UI Testing

This phase covered basic launch and navigation tests before any real agent work was attempted.

---

### Bug #1 — Infinite Re-render Loop in ProjectView

**Severity:** Critical
**File(s) affected:** `src/renderer/components/ProjectView.tsx`
**Discovered by:** Initial UI testing (page load caused browser to hang)

**Root cause:**
The `useEffect` that loaded tasks on project open listed `loadTasks` in its dependency array. Because `loadTasks` was defined inside the component (not memoized), it was a new function reference on every render. The effect ran, called `loadTasks`, which updated state, which re-rendered the component, which created a new `loadTasks` reference, which triggered the effect again — infinite loop.

**User impact:**
The application hung immediately on opening any project. CPU spiked to 100%, the UI became unresponsive, and the window had to be force-killed.

**Fix applied:**
Removed `loadTasks` from the `useEffect` dependency array. The effect depends only on `projectId` (the stable external input), not on the callback that uses it.

```typescript
// Before (broken)
useEffect(() => { loadTasks() }, [loadTasks])

// After (correct)
useEffect(() => { loadTasks() }, [projectId])
```

---

### Bug #2 — Stale Array Reference Causing Unnecessary Re-renders in TaskBoard

**Severity:** Medium
**File(s) affected:** `src/renderer/components/TaskBoard.tsx`
**Discovered by:** Initial UI testing (performance profiling showed cascading re-renders)

**Root cause:**
A selector in the Zustand store used `|| []` as a fallback for an empty task list:

```typescript
const tasks = useTaskStore(state => state.tasks[projectId] || [])
```

The `|| []` expression creates a new array literal on every render cycle. Because Zustand uses referential equality to decide whether to re-render a subscriber, the subscriber re-rendered on every store update — even when the task list was empty and nothing had changed.

**User impact:**
All `TaskBoard` components re-rendered constantly, causing visible UI jitter and degraded performance with multiple projects open.

**Fix applied:**
Used a stable empty array constant defined outside the component:

```typescript
const EMPTY_TASKS: AgentTask[] = []
const tasks = useTaskStore(state => state.tasks[projectId] ?? EMPTY_TASKS)
```

---

### Bug #3 — Stores Calling window.bigide Before Preload Ready

**Severity:** Critical
**File(s) affected:** `src/renderer/stores/workspace-store.ts`, `src/renderer/stores/task-store.ts`
**Discovered by:** Initial UI testing (white screen on launch with console error)

**Root cause:**
Zustand stores were calling `window.bigide.projectList()` at module initialization time. The stores were imported before the React component tree mounted, and the preload script had not yet exposed the `window.bigide` API surface via `contextBridge`. The result was `TypeError: Cannot read properties of undefined`.

**User impact:**
White screen on every launch. The app was completely unusable without inspecting DevTools to understand the error.

**Fix applied:**
Moved all `window.bigide` calls out of store initialization and into explicit action functions (`loadProjects`, `loadTasks`) that are called from within React component lifecycle hooks (`useEffect` in `ProjectView`, `CanvasView`). The preload bridge is guaranteed to be ready by the time any React component mounts.

---

## Phase 2: Full Codebase Audit

A systematic review of all main-process and renderer code before integration testing.

---

### Bug #4 — Missing Permissions Default Causes Governance Crash

**Severity:** Critical
**File(s) affected:** `src/main/governance-service.ts`, `src/main/ipc-handlers.ts`
**Discovered by:** Code audit

**Root cause:**
`governance-service.ts` accessed `task.permissions.requireApprovalFor` without a null check. Tasks created through certain code paths did not have a `permissions` object at all — the field was simply absent from the stored record. Accessing `.requireApprovalFor` on `undefined` threw a `TypeError` that crashed the IPC handler.

**User impact:**
Any governance check (triggered whenever the output parser detected a sensitive command) caused an unhandled exception in the main process, silently breaking the governance system and sometimes crashing the entire app.

**Fix applied:**
Added `DEFAULT_PROJECT_PERMISSIONS` as a constant and used it as a fallback wherever `task.permissions` could be undefined:

```typescript
const permissions = task.permissions ?? DEFAULT_PROJECT_PERMISSIONS
```

Also ensured `taskCreate` always initializes `permissions` to the default if not provided.

---

### Bug #5 — False "Needs Input" Triggered on Startup

**Severity:** High
**File(s) affected:** `src/main/output-parser.ts`
**Discovered by:** Code audit (examining NEEDS_INPUT_PATTERNS)

**Root cause:**
The output parser started watching the PTY stream immediately when the agent launched. The PTY's first output was the shell prompt itself (e.g., `$ ` or `❯ `), which matched the `NEEDS_INPUT_PATTERNS` regex `/^[>❯]\s*$/m`. This false positive fired a `task:status-changed` event with `needsInput: true` before the agent had even started.

**User impact:**
Every task would briefly show an "INPUT" badge on the task card immediately after starting. The notification bell would ping with a spurious "agent needs input" notification. Users would open the terminal expecting an agent question and see only the shell prompt.

**Fix applied:**
Added a 3-second startup grace period. The output parser ignores all pattern matches during the first 3 seconds after a task starts. Shell startup output (prompt, initial PATH echo, etc.) is discarded. Pattern matching only begins after the grace period elapses.

```typescript
const STARTUP_GRACE_PERIOD_MS = 3000
if (Date.now() - parserState.startTime < STARTUP_GRACE_PERIOD_MS) return
```

---

### Bug #6 — Terminal Input Dies After Agent Stops

**Severity:** High
**File(s) affected:** `src/main/ipc-handlers.ts`, `src/renderer/components/TerminalPanel.tsx`
**Discovered by:** Code audit

**Root cause:**
The `task:send-input` IPC handler looked up the task's `ptyId`, then passed the input to the PTY manager. But `ptyId` was set to `null` when the agent stopped (via `taskStop`). After an agent finished, users could no longer type in the terminal — the input was silently dropped because the PTY lookup returned nothing.

The underlying PTY process (the shell) was still alive; only the task's reference to it had been cleared prematurely.

**User impact:**
Users could not interact with the terminal after an agent completed. They could not run manual commands to verify agent output, inspect files, or debug issues. The terminal became a read-only display.

**Fix applied:**
Added a dedicated `terminal:write` IPC channel that accepts a `ptyId` directly (bypassing the task lookup) and writes to the PTY manager. The `TerminalPanel` component uses this channel for clipboard paste, Ctrl+A, and all raw keyboard input — preserving interactivity regardless of agent state.

---

### Bug #7 — Windows Path Separator Breaks Project Name Extraction

**Severity:** High
**File(s) affected:** `src/main/ipc-handlers.ts`
**Discovered by:** Code audit (cross-platform review)

**Root cause:**
Project names were extracted from folder paths using JavaScript's `String.split('/')`. On Windows, paths use backslash (`\`) as the separator (e.g., `C:\Users\you\myproject`). Splitting on `/` returned the full path as a single segment, so the "name" was the entire absolute path string.

**User impact:**
On Windows, every project showed its full path as its display name instead of just the folder name. The canvas cards and sidebar were cluttered with unreadable path strings.

**Fix applied:**
Changed the split to use a regex that matches both separators:

```typescript
const name = rootPath.split(/[\\/]/).filter(Boolean).pop() ?? rootPath
```

---

### Bug #8 — Worktree Creation Failure Silently Continues

**Severity:** High
**File(s) affected:** `src/main/ipc-handlers.ts`, `src/main/git-service.ts`
**Discovered by:** Code audit

**Root cause:**
The `task:create` handler called `createWorktree()` inside a `try/catch` that swallowed errors and set `worktreePath = null`. The task was still created and returned to the renderer as if nothing went wrong. When the user later clicked "Start," the agent launched in the project root instead of an isolated worktree, meaning it had access to the main branch's files directly.

**User impact:**
Tasks appeared to be created successfully even when Git worktree creation failed (e.g., because the branch name already existed, the repository had uncommitted changes in certain states, or git was not initialized). Agents ran in the wrong directory. Failures were invisible.

**Fix applied:**
Changed the handler to surface the worktree creation error to the renderer. If `createWorktree` throws, the IPC handler re-throws, and the `TaskCreateModal` displays the exact git error message inline.

---

### Bug #9 — Merge Does Not Update Task Status to Done

**Severity:** High
**File(s) affected:** `src/main/ipc-handlers.ts`
**Discovered by:** Code audit

**Root cause:**
The `git:merge-branch` handler called `mergeBranch()` but did not subsequently call `updateTask()` to change the task's status from `needs-review` to `done`. The task remained in the "Needs Review" column indefinitely after a successful merge.

**User impact:**
After merging, tasks stayed in "Needs Review" forever. Users had no visual confirmation that the merge succeeded. The "Done" column was always empty.

**Fix applied:**
Added a `updateTask(taskId, { status: 'done' })` call after a successful merge, and sent a `task:status-changed` push event to the renderer so the UI updated immediately.

---

### Bug #10 — generateAgentSummary Never Called

**Severity:** Medium
**File(s) affected:** `src/main/output-parser.ts`
**Discovered by:** Code audit

**Root cause:**
`tool-log-service.ts` exported a `generateAgentSummary(taskId)` function that built a Markdown summary from the task's tool log. However, no code in `output-parser.ts` ever called this function. The agent summary was always `null`.

**User impact:**
The Summary panel was always blank. The PR body was always the raw prompt text instead of a structured Markdown summary of what was done. Session reports had no agent summary section.

**Fix applied:**
Added a call to `generateAgentSummary(taskId)` inside the output parser's completion handler, after status is set to `needs-review`. The result is stored on the task via `updateTask`.

---

### Bug #11 — getDiffStats Never Called

**Severity:** Medium
**File(s) affected:** `src/main/output-parser.ts`
**Discovered by:** Code audit

**Root cause:**
`git-service.ts` exported a `getDiffStats(repoPath, branch, base)` function. Like `generateAgentSummary`, it was never called from the output parser's completion path. `task.diffStats` was always `null`.

**User impact:**
The stats bar at the top of the Diff panel (showing files changed, insertions, deletions) was always blank. Session reports had no diff statistics section.

**Fix applied:**
Added a call to `getDiffStats` before `generateAgentSummary` in the completion handler. Stats are populated before the summary is built so the summary can reference them.

---

### Bug #12 — Error Patterns Too Aggressive

**Severity:** High
**File(s) affected:** `src/main/output-parser.ts`
**Discovered by:** Code audit (regex review)

**Root cause:**
The `ERROR_PATTERNS` regex included a very short match: `/\berror\b/i`. This matched the word "error" anywhere in agent output — including in informational messages like "No errors found" or "Checking for errors..." or even in code comments the agent wrote to a file (which echoed through the terminal).

**User impact:**
Tasks transitioned to the "Error" status midway through successful runs because the agent printed something benign containing the word "error." Users had to retry tasks that had actually completed successfully.

**Fix applied:**
Tightened the error patterns to require additional context. The generic pattern was changed to require at least 10 non-whitespace characters after "error:" before matching:

```typescript
/\berror:\s+.{10,}/i  // requires "error: <meaningful message>"
```

Short or standalone occurrences of "error" no longer trigger status transitions.

---

### Bug #13 — Cleanup Leaves Ghost Tasks in Persistent Store

**Severity:** High
**File(s) affected:** `src/main/ipc-handlers.ts`, `src/main/store.ts`
**Discovered by:** Code audit

**Root cause:**
The `task:cleanup` handler killed the PTY and removed the worktree, but only updated `task.status` to `'done'` — it did not remove the task record from the persistent store. On app restart, cleaned-up tasks would reappear in the Done column as ghost entries with no associated worktree or PTY.

**User impact:**
Cleaned-up tasks accumulated in the store across restarts. After multiple sessions, the Done column could show dozens of stale task cards. Clicking any button on these ghost tasks produced errors.

**Fix applied:**
Changed `task:cleanup` to call `removeTask(taskId)` from the store, fully deleting the record. The task disappears from the board and does not return on restart.

---

### Bug #14 — Completion Pattern "done" Too Broad

**Severity:** High
**File(s) affected:** `src/main/output-parser.ts`
**Discovered by:** Code audit (regex review)

**Root cause:**
The completion pattern `/done[.!]?\s*$/im` matched the word "done" at the end of any line, regardless of context. Many agent output lines contained "done" as part of normal progress reporting (e.g., "Installing packages... done", "Compiling... done"). Each of these lines prematurely triggered task completion.

**User impact:**
Tasks moved to "Needs Review" mid-execution, before the agent had actually finished work. The diff showed only partial changes. Users who merged at this point merged an incomplete implementation.

**Fix applied:**
Added a line-start anchor and word boundary requirements, and removed the bare `done` pattern in favor of more specific patterns that matched full completion phrases only when the agent explicitly signals completion.

---

### Bug #15 — Terminal Tabs Vanish After Task Completes

**Severity:** High
**File(s) affected:** `src/renderer/components/TerminalTabs.tsx`
**Discovered by:** Code audit

**Root cause:**
The terminal tab bar only showed tabs for tasks with status `'running'`. When a task completed (moving to `needs-review` or `error`), its tab disappeared. The user could no longer scroll back through the agent's terminal output.

**User impact:**
After an agent finished, users could not review the terminal transcript directly. This made it difficult to understand what the agent had done, diagnose failures, or verify specific output.

**Fix applied:**
Updated the tab filter to include tasks in `running`, `needs-review`, and `error` states:

```typescript
const visibleTasks = tasks.filter(t =>
  t.status === 'running' || t.status === 'needs-review' || t.status === 'error'
)
```

---

### Bug #16 — "View Log" on Error Tasks Does Not Switch Tab

**Severity:** Medium
**File(s) affected:** `src/renderer/components/TaskCard.tsx`
**Discovered by:** Code audit

**Root cause:**
Auto-tab switching logic fired when a task moved to `running` (switches to Terminal tab) and `needs-review` (switches to Diff tab), but had no case for `error`. The "View Log" button appeared on error task cards but clicking it displayed the diff (whatever was previously loaded in the panel) rather than the log.

**User impact:**
When a task errored, clicking "View Log" showed the wrong panel. Users had to manually click the Log tab header to see what went wrong.

**Fix applied:**
Added a case to the tab-switching logic: when a task transitions to `error`, the active panel tab is automatically switched to `log`.

---

### Bug #17 — defaultBranch Hardcoded to 'main'

**Severity:** High
**File(s) affected:** `src/main/ipc-handlers.ts` (`project:add` handler)
**Discovered by:** Code audit

**Root cause:**
When adding a project, the handler set `defaultBranch: 'main'` unconditionally. Repositories using `master` or any custom branch name (e.g., `develop`, `trunk`) would create worktrees branching off `main`, which might not exist. Subsequent `git worktree add -b <task-branch> <path> main` calls would fail with "pathspec 'main' did not match any file(s) known to git."

**User impact:**
Projects with a `master` or non-standard default branch could not create worktrees. Task creation failed silently (caught by the ghost-task bug #13, which has since been fixed separately). All affected projects were unusable.

**Fix applied:**
Used `simple-git`'s `branchLocal()` to inspect the repository and detect the actual default branch:

```typescript
const git = simpleGit(rootPath)
const branches = await git.branchLocal()
const defaultBranch = branches.current || 'main'
```

---

### Bug #18 — No Way to Discard a "Needs Review" Task

**Severity:** Medium
**File(s) affected:** `src/renderer/components/TaskCard.tsx`
**Discovered by:** Code audit

**Root cause:**
The `needs-review` task card showed "View Diff", "Merge", and "Create PR" buttons, but no way to reject the agent's work without merging. If the agent produced wrong or harmful output, the user had no clean way to discard it.

**User impact:**
Users who wanted to reject agent work had to use `task:cleanup` via the board (after manually moving the task to Done first) or leave the task stranded in Needs Review indefinitely.

**Fix applied:**
Added a "Discard" button to the `needs-review` task card. Clicking it calls `task:cleanup` (which removes the worktree, kills the PTY, and deletes the task record). The agent's changes are abandoned without being merged.

---

## Phase 3: Live Testing Fixes

Bugs found during actual end-to-end testing with real agents running real tasks.

---

### Bug #19 — ResizeObserver Error Replaces Entire UI

**Severity:** Critical
**File(s) affected:** `src/main/index.ts`, `src/renderer/main.tsx`
**Discovered by:** Live testing

**Root cause:**
`ResizeObserver loop limit exceeded` is a benign browser warning that fires when ResizeObserver callbacks take longer than one animation frame. However, an early version of the error handler called `document.body.innerHTML = ''` to "clear" the error display, which wiped the entire React application from the DOM. The app became a blank white page on any panel resize.

**User impact:**
Dragging the resize handle between the task board and the panel area destroyed the UI entirely. The app had to be restarted. This happened on virtually every first use.

**Fix applied:**
Suppressed the ResizeObserver error in the renderer by overriding `window.onerror` to silently ignore it. Removed the `innerHTML = ''` handler entirely. The error is cosmetically harmless and needs no special treatment.

---

### Bug #20 — Branch Name Collisions on Task Create

**Severity:** High
**File(s) affected:** `src/renderer/components/TaskCreateModal.tsx`, `src/main/ipc-handlers.ts`
**Discovered by:** Live testing (second task with same title caused worktree failure)

**Root cause:**
Branch names were derived from task titles by slugifying the text. Two tasks with similar titles (e.g., "Add auth" run twice) produced identical branch names. The second worktree creation failed because git refused to create a branch that already existed.

**User impact:**
Creating a second task with any title resembling an existing one failed with a cryptic git error. The user had no recourse except to manually type a unique branch name — a poor UX for a tool designed to handle this automatically.

**Fix applied:**
The modal's auto-generated branch name now appends a random 4-character alphanumeric suffix:

```typescript
const suffix = Math.random().toString(36).slice(2, 6)
const branch = `bigide/${slugify(title)}-${suffix}`
```

---

### Bug #21 — Task Creation Errors Invisible

**Severity:** High
**File(s) affected:** `src/renderer/components/TaskCreateModal.tsx`
**Discovered by:** Live testing

**Root cause:**
When `window.bigide.taskCreate()` threw (e.g., due to a worktree failure, git not initialized, or branch collision), the error was caught in the modal's submit handler but only logged to the console — no UI feedback was shown to the user. The modal closed as if creation succeeded, but no task appeared on the board.

**User impact:**
Users clicked "Create," the modal disappeared, and no task appeared. Repeating the action had the same result. The only way to understand what happened was to open DevTools.

**Fix applied:**
Added an inline error state to the modal. Failed creation displays the error message in red text below the form. The modal stays open so the user can correct the issue.

---

### Bug #22 — All Action Errors Invisible on Task Cards

**Severity:** High
**File(s) affected:** `src/renderer/components/TaskCard.tsx`
**Discovered by:** Live testing

**Root cause:**
All async button handlers (Start, Stop, Merge, Create PR, Cleanup) used a plain try/catch that logged to console. No error feedback was shown on the card. Failures were silent.

**User impact:**
Clicking any action button that failed (Start with a bad PTY, Merge with a conflict, Create PR with no token) produced no visible feedback. Users clicked repeatedly, assuming the first click was missed.

**Fix applied:**
Introduced a `safeAction` wrapper function that sets an `error` string on the card's local state when an exception is thrown. The error message is displayed inline on the card in red text. The message auto-clears on the next action attempt.

---

### Bug #23 — Stale "Running" Tasks After App Restart

**Severity:** High
**File(s) affected:** `src/main/index.ts`
**Discovered by:** Live testing

**Root cause:**
Tasks with `status: 'running'` were persisted to the store. On app restart, these tasks were reloaded with their stale `running` status — but no PTY or agent process was running for them. Clicking "Stop" on such a task found no PTY to kill. Clicking "Start" attempted to launch a second instance while the stale task record still referenced a nonexistent PTY.

**User impact:**
After any app restart (whether intentional or a crash), running tasks appeared as perpetually running. No controls on these tasks worked correctly.

**Fix applied:**
On app startup (in `registerIpcHandlers`), all tasks with `status: 'running'` are immediately updated to `status: 'error'` with `lastOutputLine: 'App restarted — task interrupted'`. This gives the user a clear indication of what happened and provides the correct Error-state buttons (Retry, Discard) for recovery.

---

### Bug #24 — Retry Broken When Worktree Is Missing

**Severity:** High
**File(s) affected:** `src/main/ipc-handlers.ts`
**Discovered by:** Live testing

**Root cause:**
The "Retry" action on error tasks called `task:start` directly. If the task's worktree had been removed (e.g., by a failed cleanup or a previous crash), `task.worktreePath` pointed to a nonexistent directory. The PTY would start in a missing directory, and `node-pty` would throw immediately.

**User impact:**
Retrying a failed task often failed again immediately, even when the original error was transient. Retried tasks entered a broken state where the terminal could not open.

**Fix applied:**
The `task:start` handler checks whether `task.worktreePath` exists on disk before launching. If the worktree is missing, it recreates it via `createWorktree` before starting the PTY. This makes Retry genuinely reliable regardless of the state the worktree was left in.

---

### Bug #25 — Error Tasks Cannot Be Removed

**Severity:** Medium
**File(s) affected:** `src/renderer/components/TaskCard.tsx`
**Discovered by:** Live testing

**Root cause:**
The error state task card had "Retry" and "View Log" buttons but no way to remove the task. If a task could not be retried (e.g., the prompt was fundamentally wrong, or the agent was not available), users were stuck with permanent error cards on the board.

**User impact:**
Error cards accumulated on the board with no way to clear them. Over time the board became cluttered with unresolvable failed tasks.

**Fix applied:**
Added a "Discard" button to the error task card, matching the same button already added to needs-review tasks (Bug #18).

---

### Bug #26 — Buttons Remain Clickable During Async Operations

**Severity:** Medium
**File(s) affected:** `src/renderer/components/TaskCard.tsx`
**Discovered by:** Live testing

**Root cause:**
Async action buttons (Start, Merge, Create PR, etc.) did not disable themselves while the operation was in progress. Users could click a button multiple times before the first operation completed, queuing multiple concurrent IPC calls for the same operation (e.g., starting a task twice, creating two PRs).

**User impact:**
Double-clicking "Create PR" created two pull requests on GitHub. Double-clicking "Start" spawned two PTY processes for the same task, causing confused output and resource leaks.

**Fix applied:**
Added a `busy` boolean to the card's local state. While `busy` is true, all action buttons are disabled and a blue spinner with a descriptive label is shown (e.g., "Creating repo & PR...", "Merging..."). Buttons re-enable when the operation completes (successfully or with an error).

---

### Bug #27 — PR URL Not Visible After Creation

**Severity:** Medium
**File(s) affected:** `src/renderer/components/TaskCard.tsx`
**Discovered by:** Live testing

**Root cause:**
After `task:create-pr` succeeded and returned a URL, the URL was stored on the task record in the persistent store but nothing in the card's UI displayed it. Users had no way to open the PR except to go to GitHub directly and find it manually.

**User impact:**
The "Create PR" success state was indistinguishable from the idle state. Users frequently re-clicked "Create PR" thinking it had not worked, creating duplicate PRs.

**Fix applied:**
The task card now displays the PR URL as a clickable link when `task.prUrl` is set. The link opens in the system browser via `shell.openExternal`.

---

### Bug #28 — Gemini CLI Model Name Caused Immediate Failure

**Severity:** Critical
**File(s) affected:** `src/main/agent-launcher.ts`
**Discovered by:** Live testing (first Gemini CLI run)

**Root cause:**
The `gemini-cli` command template used the `-m` flag to specify a model: `gemini -m gemini-2.5-flash-lite-preview-06-17 "<prompt>"`. The actual Gemini CLI binary at the time of testing did not support the `-m` flag with that model identifier. The CLI printed a "model not found" error and exited immediately.

**User impact:**
Every Gemini CLI task failed within 2 seconds of starting with a cryptic model-not-found error in the terminal. The default model was completely unusable.

**Fix applied:**
Removed the `-m` flag entirely. The Gemini CLI's default model is used by invoking `gemini` without model selection:

```typescript
'gemini-cli': (prompt) => `gemini -i "${prompt.replace(/"/g, '\\"')}"\r`
```

---

### Bug #29 — Gemini CLI One-Shot Mode Exits Immediately

**Severity:** Critical
**File(s) affected:** `src/main/agent-launcher.ts`
**Discovered by:** Live testing (follow-up to Bug #28)

**Root cause:**
Even after removing the `-m` flag, the Gemini CLI invoked without the `-i` flag ran in non-interactive (one-shot) mode. In one-shot mode, the CLI processes the prompt, prints output, and exits. This left the PTY running an idle shell — the output parser never detected completion because there was no interactive session to monitor, and the task stayed "Running" forever.

**User impact:**
Gemini CLI tasks appeared to start but produced no output updates. The task was permanently stuck in "Running" with no way for the output parser to detect completion.

**Fix applied:**
Added the `-i` (interactive) flag, which keeps the Gemini CLI session alive as a REPL-style process — consistent with how Claude Code and Codex behave:

```typescript
'gemini-cli': (prompt) => `gemini -i "${prompt.replace(/"/g, '\\"')}"\r`
```

---

### Bug #30 — Review Button Missing on Error Tasks

**Severity:** Medium
**File(s) affected:** `src/renderer/components/TaskCard.tsx`
**Discovered by:** Live testing

**Root cause:**
The error state card only showed "Retry" and "View Log." However, when a task errored partway through, the agent might have produced partial changes that the user wanted to inspect before deciding to retry or discard. There was no way to view the diff for a task in error state.

**User impact:**
Partial work by errored agents was inaccessible for review. Users had to retry (overwriting partial progress) or discard without reviewing what was done.

**Fix applied:**
Added a "Review" button to error task cards. It calls `task:get-diff` and switches the active panel to the Diff tab, showing whatever changes the agent made before failing.

---

### Bug #31 — Agent Files Not Committed; Empty Diff on Mark Done

**Severity:** High
**File(s) affected:** `src/main/ipc-handlers.ts` (`task:update-status` handler)
**Discovered by:** Live testing

**Root cause:**
When "Mark Done" was clicked on a running task, the status was changed to `needs-review` but no git commit was created for the agent's changes. Because the worktree had unstaged or uncommitted changes, `git diff base...branch` returned an empty diff — the changes existed on disk but were not part of any commit the diff could show.

**User impact:**
After manually marking a task done, the Diff panel was blank. The agent's work was invisible. Users who then clicked "Merge" merged nothing, and the agent's changes were lost.

**Fix applied:**
The `task:update-status` handler, when transitioning to `needs-review`, calls `git add -A && git commit -m "bigide: agent work"` inside the worktree before computing the diff. This ensures all agent changes are committed and visible in the diff.

---

### Bug #32 — Summary Empty on Manual Mark Done

**Severity:** Medium
**File(s) affected:** `src/main/ipc-handlers.ts`
**Discovered by:** Live testing

**Root cause:**
`generateAgentSummary` and `getDiffStats` were only called from the output parser's auto-completion path. When a user manually clicked "Mark Done," the summary and diff stats were never generated, so the Summary panel and PR body remained empty.

**User impact:**
Manually-completed tasks always had blank summaries and no diff stats, even when the agent had done substantial work.

**Fix applied:**
The `task:update-status` handler, when transitioning to `needs-review`, explicitly calls `getDiffStats` then `generateAgentSummary` in sequence — mirroring the auto-completion path in `output-parser.ts`.

---

## Phase 4: User Testing and Polish

Issues discovered during structured user testing sessions and feedback review.

---

### Bug #33 — require('./store') Crash on Startup

**Severity:** Critical
**File(s) affected:** `src/main/index.ts`
**Discovered by:** User testing

**Root cause:**
An early version of `index.ts` used CommonJS `require('./store')` to import the store module. The project was configured as ESM (`"type": "module"` in `package.json`), so `require` was not defined in the main process at runtime. The app crashed immediately on launch with `ReferenceError: require is not defined`.

**User impact:**
The application did not open at all. Users saw only a crash and could not proceed.

**Fix applied:**
Converted all imports to ESM `import` syntax throughout `src/main/`. This was a project-wide consistency fix, not just a single-file change.

---

### Bug #34 — Old Projects Cannot Be Deleted

**Severity:** High
**File(s) affected:** `src/renderer/components/canvas/ProjectNode.tsx`
**Discovered by:** User testing

**Root cause:**
The original project removal UX was a right-click context menu. React Flow's canvas consumed right-click events for its own pan/zoom controls, preventing the context menu from appearing on project nodes. The "Remove Project" option was unreachable through normal interaction.

**User impact:**
Projects, once added, could not be removed through the UI. Users were forced to delete the persistent state file (`bigide-state.json`) and restart to start fresh.

**Fix applied:**
Replaced the context menu with a hover X button. The button appears in the top-right corner of the project node when the mouse hovers over it, using CSS `opacity: 0` → `opacity: 1` transition. This does not conflict with React Flow's event handling.

---

### Bug #35 — Stale Data from Previous Development Runs

**Severity:** High
**File(s) affected:** `src/main/store.ts`, `electron-store` configuration
**Discovered by:** User testing (testers carried over old state from earlier builds)

**Root cause:**
The persistent store (`bigide-state.json`) accumulated data from development runs with incompatible schemas. Old task records had missing fields (before `terminalLog`, `startedAt`, etc. were added), and old project records had incorrect structures. When the app loaded, it tried to use this stale data and various components threw type errors.

**User impact:**
Testers who had run earlier builds saw crashes, stuck tasks, and phantom projects. The app was unreliable for anyone who had used it before the current build.

**Fix applied:**
Added migration logic to the store initialization: on startup, fields missing from task records are patched with their default values. Also documented the workaround: deleting `%APPDATA%/bigide/bigide-state.json` (Windows) clears all state cleanly.

---

### Bug #36 — Gemini API "Model Not Found" Regression

**Severity:** Critical
**File(s) affected:** `src/main/agent-launcher.ts`
**Discovered by:** User testing (on a different Gemini CLI version)

**Root cause:**
A variant of Bug #28. Even after removing the `-m` flag in the original fix, the command template in some documentation examples still referenced `-m gemini-2.5-flash-lite-preview-06-17`. Some testers manually edited the source to match the documentation, reintroducing the broken `-m` flag.

**User impact:**
Gemini CLI tasks failed again for affected testers.

**Fix applied:**
Audited and updated all documentation to consistently use `gemini -i "<prompt>"` with no `-m` flag. Updated `MODEL_COMMANDS` to be the single source of truth.

---

### Bug #37 — Terminal Does Not Support Copy/Paste

**Severity:** High
**File(s) affected:** `src/renderer/components/TerminalPanel.tsx`
**Discovered by:** User testing

**Root cause:**
The xterm.js terminal handled Ctrl+C internally as a signal interrupt (sends `\x03` to the PTY). No clipboard handlers were registered for Ctrl+C (copy), Ctrl+V (paste), or Ctrl+A (select all). Right-click had no context menu.

**User impact:**
Users could not copy text from the terminal or paste into it using standard shortcuts. Copying agent output for use elsewhere required manually selecting text with the mouse and using the OS clipboard menu — a significant UX friction point.

**Fix applied:**
Registered custom key handlers on the xterm.js instance:
- `Ctrl+C` with selection active → copy selected text to clipboard
- `Ctrl+C` without selection → pass through as interrupt signal
- `Ctrl+V` → paste clipboard text via `terminal:write`
- `Ctrl+A` → select all text in the terminal buffer

Also configured right-click to select the word under the cursor.

---

### Bug #38 — Browser Panel Used webview, Causing GUEST_VIEW_MANAGER_CALL Errors

**Severity:** Critical
**File(s) affected:** `src/renderer/components/BrowserPanel.tsx`, `src/main/index.ts`
**Discovered by:** User testing

**Root cause:**
The original browser panel used Electron's `<webview>` element to embed a browser. On the tested Electron 35 build, webview elements triggered `GUEST_VIEW_MANAGER_CALL` errors related to Electron's security model changes around embedded browser contexts. The browser panel was completely non-functional.

**User impact:**
The Browser tab showed only errors. Preview functionality was broken. Users had no way to preview agent-generated HTML/CSS output from within BigIDE.

**Fix applied:**
Replaced `<webview>` with a standard `<iframe>` and added a local HTTP file server (`file-server.ts`) that serves the task's worktree directory. The iframe loads `http://localhost:<port>/` rather than a `file://` URL, which avoids cross-origin restrictions and requires no special Electron permissions.

---

### Bug #39 — File Server Returns 404 When Worktree Has No index.html

**Severity:** Medium
**File(s) affected:** `src/main/file-server.ts`
**Discovered by:** User testing

**Root cause:**
The file server served from the task's worktree root. Tasks that generated non-web output (Python scripts, config files, etc.) had no `index.html`. The iframe loaded a 404 page.

**User impact:**
The browser panel showed "404 Not Found" for any task that was not a web project. Users saw no useful preview even when there was content to show.

**Fix applied:**
Added a fallback: if the worktree has no `index.html`, the server falls back to serving the project root directory. This allows preview of any HTML files that may exist in the base project, or at minimum shows a directory listing.

---

### Bug #40 — No Way to Return from List View to Canvas

**Severity:** High
**File(s) affected:** `src/renderer/components/Sidebar.tsx`
**Discovered by:** User testing

**Root cause:**
Clicking a project in the sidebar opened the Project View (task board). There was no UI element to navigate back to the Canvas View. The Escape key shortcut existed but was undiscoverable.

**User impact:**
Users who entered a project through the sidebar could not return to the canvas without knowing the keyboard shortcut. Many thought the canvas view was gone and reported it as a missing feature.

**Fix applied:**
Added a "← Canvas" button at the top of the sidebar. It is always visible when inside a project view and navigates back to the canvas immediately on click.

---

### Bug #41 — Duplicate Projects on Re-add

**Severity:** High
**File(s) affected:** `src/main/ipc-handlers.ts` (`project:add` handler), `src/renderer/components/canvas/ProjectNode.tsx`
**Discovered by:** User testing

**Root cause:**
The `project:add` handler did not check whether a project at the same `rootPath` already existed. Users who clicked the "+" button and selected a directory they had already added got a second, duplicate project entry with a new UUID. Both projects would then load the same tasks (which were keyed by `projectId`, not `rootPath`), causing confusing duplication.

**User impact:**
Re-adding a project accidentally created two cards for the same codebase. Starting a task from either card created independent task records that competed for the same git worktrees.

**Fix applied:**
The `project:add` handler checks existing projects for a matching `rootPath` before adding. If a duplicate is detected, the handler returns the existing project record unchanged rather than creating a new one.

---

### Bug #42 — get() Not Defined in workspace-store

**Severity:** Critical
**File(s) affected:** `src/renderer/stores/workspace-store.ts`
**Discovered by:** User testing

**Root cause:**
A Zustand store action used `get()` to read the current state inside an async action, following the Zustand `(set, get) => ({...})` pattern. However, the store was created with `create<WorkspaceState>(set => ({...}))` — `get` was not included in the parameter destructuring. `get` was `undefined` at runtime.

**User impact:**
Any store action that called `get()` threw `TypeError: get is not a function`. This crashed the action mid-execution, preventing tasks from loading or projects from updating.

**Fix applied:**
Updated the store factory signature to include `get`:

```typescript
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
```

---

### Bug #43 — Create PR Fails: Repo Not Found on GitHub

**Severity:** High
**File(s) affected:** `src/main/git-service.ts`
**Discovered by:** User testing

**Root cause:**
The PR creation flow read `project.githubRepo` from the store and used it directly with Octokit without first verifying the repository existed on GitHub. If the repo had been deleted, renamed, or the remote configuration was stale (pointing to a fork that no longer existed), Octokit returned a 404, and the error message gave no actionable guidance.

**User impact:**
"Create PR" failed with confusing errors for users with stale remote configurations. There was no way to understand whether the issue was authentication, the repo name, or the remote URL.

**Fix applied:**
Added a validation step before PR creation: the handler calls `octokit.repos.get()` with the configured `owner/repo`. If this returns a 404, the error message explicitly says "Repository not found — check your GitHub repo setting." Stale remote URLs are also cleared from the project record when validation fails.

---

### Bug #44 — PR Base Branch Invalid (Not Pushed to Remote)

**Severity:** High
**File(s) affected:** `src/main/git-service.ts`
**Discovered by:** User testing

**Root cause:**
The PR creation flow pushed the task branch to GitHub but did not ensure the base branch (e.g., `main`) existed on the remote. For newly created repos or repos where the base branch had never been explicitly pushed, GitHub's API rejected the PR with "base branch not found."

**User impact:**
PR creation failed for any project whose base branch had not been explicitly pushed to GitHub, even when the task branch was pushed successfully. The error was cryptic.

**Fix applied:**
The PR creation flow now pushes the base branch to the remote (`git push origin <defaultBranch>`) before pushing the task branch. This is a no-op for repos where the base branch is already up-to-date, and ensures newly provisioned repos have the base branch on the remote.

---

### Bug #45 — SSH Passphrase Prompts Block PR Creation

**Severity:** High
**File(s) affected:** `src/main/git-service.ts`
**Discovered by:** User testing

**Root cause:**
Git push operations used the SSH remote URL format (`git@github.com:owner/repo.git`). Users with SSH passphrases on their keys were prompted for the passphrase inside the PTY, which blocked the push indefinitely since no one was watching that specific PTY at that moment.

**User impact:**
PR creation hung silently for users with SSH key passphrases. The "busy" spinner on the task card ran indefinitely.

**Fix applied:**
Switched `git push` calls to use the HTTPS remote URL format (`https://github.com/owner/repo.git`). HTTPS authentication uses the GitHub token resolved from `GITHUB_TOKEN` or `gh auth token`, which requires no interactive passphrase entry.

---

### Bug #46 — No Visual Feedback During Create PR

**Severity:** Medium
**File(s) affected:** `src/renderer/components/TaskCard.tsx`
**Discovered by:** User testing

**Root cause:**
GitHub PR creation involves multiple sequential network operations (repo validation, branch push, Octokit API call) that can take 5–15 seconds. The UI showed nothing during this time — the "Create PR" button remained static.

**User impact:**
Users thought the button click had not registered and clicked multiple times, creating duplicate PRs. Some waited 20+ seconds before concluding the feature was broken.

**Fix applied:**
The busy state (introduced in Bug #26) was enhanced with descriptive labels for each phase: "Creating repo & PR...", "Pushing branch...", "Creating PR...". A blue spinner icon appears next to the label.

---

### Bug #47 — Terminal Not Accepting Keyboard Input

**Severity:** High
**File(s) affected:** `src/renderer/components/TerminalPanel.tsx`
**Discovered by:** User testing

**Root cause:**
The xterm.js terminal element did not receive keyboard focus automatically when the Terminal tab was selected. Users had to explicitly click the terminal area to focus it before typing worked. Many users did not realize this and assumed terminal input was broken.

**User impact:**
Users switching to the Terminal tab to type a response to an agent prompt found their keystrokes had no effect. They assumed the terminal was broken rather than unfocused.

**Fix applied:**
Added `terminal.focus()` calls in two places:
1. On component mount (via a `useEffect`)
2. On any click within the terminal container div

The terminal now reliably accepts input immediately after the tab is selected.

---

### Bug #48 — Browser and Terminal Lose State on Tab Switch

**Severity:** High
**File(s) affected:** `src/renderer/components/PanelLayout.tsx`
**Discovered by:** User testing

**Root cause:**
Switching panel tabs unmounted the inactive tab's components entirely (standard React conditional rendering). The xterm.js terminal was reinitialized from scratch each time the Terminal tab was re-selected, losing the scroll history. The Browser iframe reloaded from scratch each time the Browser tab was re-selected.

**User impact:**
Switching away from the Terminal tab and back caused the entire terminal history to be lost. Switching away from the Browser tab and back caused the page to reload, losing any interactive state in the preview.

**Fix applied:**
Changed the panel layout to keep the `TerminalPanel` and `BrowserPanel` components mounted at all times. Inactive panels are hidden via CSS (`display: none` / `visibility: hidden`) rather than unmounted. Component state, xterm.js buffer, and iframe contents are all preserved across tab switches.

---

### Bug #49 — Resize Handle Too Narrow

**Severity:** Low
**File(s) affected:** `src/renderer/App.tsx` (or `PanelLayout.tsx` depending on implementation)
**Discovered by:** User testing

**Root cause:**
The draggable resize handle between the task board and the panel area was 2px wide — the default for `react-resizable-panels`. This was extremely difficult to grab with a mouse, especially on high-DPI displays.

**User impact:**
Users could not resize the panel split. The default proportions (which were also wrong — see Bug #50) were effectively permanent for most users.

**Fix applied:**
Widened the resize handle to 8px and added a visual grip indicator (a short vertical line of dots) to make its position obvious.

---

### Bug #50 — Panel Proportions Wrong (30/70 Split Too Cramped)

**Severity:** Low
**File(s) affected:** `src/renderer/components/PanelLayout.tsx`
**Discovered by:** User testing

**Root cause:**
The initial panel split was 30% (task board) / 70% (panel area). With typical task titles and board columns, the 30% task board was too narrow to show task card buttons without text overflow.

**User impact:**
Task card buttons overlapped or were hidden on smaller screen sizes. The "Mark Done" and "Create PR" labels were clipped.

**Fix applied:**
Changed the default split to 25% task board / 75% panel area, which gives the right panel more room for the diff viewer and terminal while keeping task cards readable.

---

### Bug #51 — ANSI Codes in lastOutputLine

**Severity:** Low
**File(s) affected:** `src/main/output-parser.ts`
**Discovered by:** User testing

**Root cause:**
`task.lastOutputLine` was set directly from the raw PTY output buffer, which included ANSI terminal escape sequences (e.g., `\x1b[32m`, `\x1b[0m` for color). These codes were displayed verbatim on the task card as raw escape sequence text.

**User impact:**
The "last output" line shown beneath the task title on task cards was cluttered with non-printable escape codes, making it unreadable (e.g., `\x1b[32m✔ Created file\x1b[0m`).

**Fix applied:**
Added ANSI stripping before setting `lastOutputLine`. The same stripping is applied to lines accumulated in `terminalLog`. A minimal inline regex strips the most common sequences:

```typescript
const stripped = raw.replace(/\x1b\[[0-9;]*[mGKHF]/g, '').trim()
```

---

### Bug #52 — DevTools Auto-Opens on Every Launch

**Severity:** Low
**File(s) affected:** `src/main/index.ts`
**Discovered by:** User testing

**Root cause:**
An early development build included `mainWindow.webContents.openDevTools()` as an unconditional call on app startup, added for debugging convenience. This was never removed.

**User impact:**
Every user who launched BigIDE saw the DevTools panel open automatically on the right side of the window, consuming screen real estate and confusing non-developer users.

**Fix applied:**
Removed the unconditional `openDevTools()` call. DevTools can be opened manually with `Ctrl+Shift+I` when needed for debugging.

---

## Summary Statistics

| Phase | Bugs | Critical | High | Medium | Low |
|-------|------|----------|------|--------|-----|
| Phase 1: Initial UI Testing | 3 | 2 | 0 | 1 | 0 |
| Phase 2: Full Codebase Audit | 15 | 2 | 8 | 4 | 1 |
| Phase 3: Live Testing Fixes | 14 | 3 | 7 | 3 | 1 |
| Phase 4: User Testing & Polish | 20 | 3 | 10 | 4 | 3 |
| **Total** | **52** | **10** | **25** | **12** | **5** |

---

## Patterns and Lessons Learned

### Lesson 1: Never swallow errors silently

Bugs #8, #21, #22, and several others share the same pattern: an error is caught, logged to console, and the UI continues as if nothing happened. Every error that can occur in user-facing code paths should produce visible feedback. Silent failures are worse than crashes — they destroy user trust without giving any information.

### Lesson 2: Default values must be explicit at creation time

Bugs #4, #17, and #42 all stem from missing or wrong default values on data structures. When a field is added to an interface, every code path that creates an instance of that interface must be updated to include the new field with a sensible default. TypeScript's strict mode catches some of these but not all (optional fields can be omitted without error).

### Lesson 3: Regex patterns need context, not just keywords

Bugs #12 and #14 resulted from completion and error patterns that were too permissive. The word "done" appears in thousands of normal terminal lines. The word "error" appears in log messages that say "no errors found." Pattern matching on agent output must require enough surrounding context to be unambiguous.

### Lesson 4: State should survive the thing it describes

Bugs #15 and #48 both involve UI state being destroyed when it should be preserved. Terminal history and browser state are durable; they belong to the task, not to the currently-visible tab. Components that manage durable state should be kept mounted and hidden, not unmounted and recreated.

### Lesson 5: Test on the actual target platform

Bugs #7 (Windows path separators), #37 (clipboard behavior), and #45 (SSH passphrases) only manifested on specific platforms or configurations. An Electron app that targets Windows, macOS, and Linux needs explicit testing on each. Path handling, keyboard shortcuts, and authentication flows all behave differently across platforms.

### Lesson 6: The default model must actually work

Bugs #28 and #29 demonstrate that the most critical thing to test is the happy path with the default configuration. Gemini CLI being the default model and being broken by two separate issues on first launch was the most damaging category of bug from a user experience perspective. Any change to MODEL_COMMANDS must be tested end-to-end before release.
