# BigIDE Development Checkpoint

**Date:** 2026-03-21
**Version:** 0.1.0
**Status:** Prototype — functional end-to-end workflow

---

## Table of Contents

1. [Purpose of This Document](#1-purpose-of-this-document)
2. [Reference Visions](#2-reference-visions)
3. [What Has Been Implemented](#3-what-has-been-implemented)
4. [What Has NOT Been Implemented](#4-what-has-not-been-implemented)
5. [Detailed Comparison: Osmani's Vision vs BigIDE](#5-detailed-comparison-osmanis-vision-vs-bigide)
6. [Detailed Comparison: Theo's Vision vs BigIDE](#6-detailed-comparison-theos-vision-vs-bigide)
7. [Features BigIDE Has That Neither Vision Explicitly Mentions](#7-features-bigide-has-that-neither-vision-explicitly-mentions)
8. [Architectural Differences](#8-architectural-differences)
9. [Known Bugs Fixed During This Phase](#9-known-bugs-fixed-during-this-phase)
10. [Known Limitations (Architectural)](#10-known-limitations-architectural)
11. [Prioritized Feature Roadmap](#11-prioritized-feature-roadmap)
12. [Summary Alignment Table](#12-summary-alignment-table)

---

## 1. Purpose of This Document

This document captures the state of BigIDE at the end of the initial development phase. It compares the current implementation against the two reference visions that inspired the project — Addy Osmani's "control plane" thesis and Theo Browne's "bigger IDE" thesis — and identifies what has been built, what is missing, and what should come next.

This is a checkpoint, not a specification. It is intended for developers picking up the project to understand where things stand and why certain decisions were made.

---

## 2. Reference Visions

### 2.1 Addy Osmani — "The IDE Is Being De-Centered"

**Core thesis:** The IDE is not dying — its center of gravity is shifting from the text editor to orchestration dashboards and control planes. The editor becomes one subordinate instrument among several.

**Five universal infrastructure patterns Osmani identifies:**

1. **Git-worktree isolation** for parallelism — each agent gets its own isolated copy of the code
2. **Task-state boards** replacing file browsers — kanban boards as the primary navigation surface
3. **Background/async-first execution** — agents run without requiring your presence; user defines intent and reviews later
4. **Attention routing** — badges, notifications, and alerts for "agent needs you now"
5. **Lifecycle integration** — issues → PRs → CI → merge, not just editing

**Key insights on failure modes:**

- The "90% correct, subtly broken" problem: agents consistently produce code that looks correct but has subtle bugs, forcing humans back into the editor for deep inspection
- Review fatigue as technical debt: 12 parallel agents = 12 diffs to verify; verifying code you didn't write demands reconstructing intent
- Governance is first-class: agents with web access, filesystem writes, and deploy triggers expand the security surface dramatically

**Tools Osmani cites as exemplars:** Conductor, Copilot Agent, Cursor Glass, Jules, Vibe KanBan

### 2.2 Theo Browne — "We Need a Bigger IDE"

**Core thesis:** The agentic IDE is fundamentally a developer operating system that orchestrates multiple parallel projects simultaneously. Not smaller (CLI-only), not the traditional VS Code fork.

**The problem Theo identifies:** When you can run agents in parallel on repos A, B, and C simultaneously, having separate terminal windows, separate VS Code windows, and separate browser tabs for each creates unbearable mental context-switching overhead. The work of navigating your tools exceeds the work of building.

**Theo's six design principles:**

1. **One level higher than the current IDE** — wrap all your projects and orchestrate relationships between them, not just one project at a time
2. **Embedded browser, terminal, and agent orchestration in one app** — no mental linking between "this terminal → VS Code window → GitHub tab → localhost tab"
3. **Infinitely nestable, zoomable canvas** — a 2D spatial workspace where you zoom out to see all projects, zoom into one, split/rearrange panels arbitrarily
4. **Multi-project worktree management as first-class primitive** — creating git worktrees should be built into the IDE, not a manual terminal operation
5. **Agent-aware orchestration** — understand multiple agents running simultaneously, show their status, let you review outputs, manage task lifecycle
6. **Unified workspace, flexible adaptation** — as you move between codebases, the IDE adapts

**Theo's honest caveat:** "Nobody has figured this out yet." The pain is clearly felt, but the crystallized solution is years away.

---

## 3. What Has Been Implemented

### 3.1 Core Architecture

- **Electron 35 desktop app** with three-process architecture (main, preload, renderer)
- **React 19** with functional components and hooks
- **Zustand** for state management (4 stores: workspace, task, notification, governance)
- **TypeScript** throughout (shared types between main and renderer)
- **TailwindCSS 4** for styling
- **electron-store** for persistent JSON storage
- **IPC bridge** with 24 channels (22 request-response + 5 push events) via contextBridge

### 3.2 Canvas View (Multi-Project Overview)

- React Flow-based 2D canvas with draggable project cards
- Task nodes attached to project nodes showing status
- MiniMap for navigation
- Zoom and pan controls
- Hover X button to remove projects
- "+" button to add projects via native folder picker
- Project count display

### 3.3 Project View (Focused Task Management)

- Kanban task board with 5 columns: Todo, Running, Review, Done, Error
- Resizable split layout (task board left, tabbed panels right)
- Tab bar: Terminal, Browser, Diff, Log, Summary
- Back button to return to canvas
- Auto-tab switching: running → terminal, needs-review → diff, error → log

### 3.4 Task Lifecycle

- **Create:** Modal with title, prompt, model selection, branch name (auto-slugified with random suffix), permissions config
- **Start:** Creates PTY, launches agent in worktree, starts output parsing
- **Monitor:** Real-time terminal output, structured tool log, status updates
- **Mark Done:** Manual transition to needs-review when output parser misses completion
- **Review:** Unified diff viewer (react-diff-view), agent summary, tool log timeline
- **Merge:** Git merge with auto-status update to "done"
- **Create PR:** Auto-creates GitHub repo if needed (via gh CLI), pushes branch, creates PR via Octokit
- **Discard:** Available on needs-review and error tasks; removes worktree and task
- **Cleanup:** Removes worktree, PTY, and task from persistent store
- **Retry:** Resets error task to todo; recreates worktree if missing

### 3.5 Agent Support

- **Gemini CLI** (default) — `gemini -i "prompt"` (interactive mode)
- **Claude Code** — `claude "prompt"`
- **Codex** — `codex "prompt"`
- **GitHub Copilot** — `gh copilot suggest "prompt"`
- **Custom** — user-defined command
- Fallback to Gemini CLI for unknown models

### 3.6 Terminal

- xterm.js with GitHub Dark theme, JetBrains Mono font
- FitAddon for auto-resizing, WebLinksAddon for clickable URLs
- Direct PTY write via `terminal:write` IPC channel (survives agent stop)
- Clipboard: Ctrl+C (copy when selected), Ctrl+V (paste), Ctrl+A (select all)
- Right-click selects word
- 5000-line scrollback
- Terminal tabs persist for completed and errored tasks (not just running)

### 3.7 Browser Preview

- Embedded iframe (switched from webview due to Electron security restrictions)
- Local HTTP file server (`file-server.ts`) serves task worktree files
- Auto-serves index.html when Preview is clicked
- URL bar with back/forward/reload/go
- MIME type support for HTML, CSS, JS, JSON, images, fonts, SVG
- Preview button in toolbar + centered call-to-action when blank
- Error display for server failures

### 3.8 Code Diff Viewer

- react-diff-view with unidiff parser
- File-by-file navigation with sticky headers
- Color-coded additions (green) and deletions (red)
- Stats bar (files changed, insertions, deletions)
- Supports add, delete, rename, modify operations

### 3.9 Tool Log Panel

- Structured timeline of agent actions
- Filter buttons: file_edit, bash, file_read, governance, other
- Real-time updates via `task:tool-logged` IPC events
- Auto-scroll to latest entry
- Timestamp, tool type, args, result, files affected per entry

### 3.10 Agent Summary Panel

- Auto-generated markdown summary on task completion
- Groups files created vs modified
- Shows diff stats (insertions/deletions)
- Lists bash commands run
- Includes original prompt
- Generated on both auto-detection and manual "Mark Done"

### 3.11 Session Report

- Auto-generated self-contained HTML report on every task completion (needs-review or done transition)
- Reports saved to `.bigide-reports/` in the project directory
- Cyan "Report" button on task cards in needs-review, done, and error states
- Clicking generates (or regenerates) the report and opens it in the default browser
- Report contents: task metadata (title, model, status, branch), start/completed timestamps + duration, original prompt, PR URL, diff stats, full color-coded diff, agent summary, tool log timeline, governance decisions, terminal transcript (ANSI-cleaned)
- New fields on `AgentTask`: `terminalLog: string[]` (up to 2000 cleaned output lines), `startedAt: number | null`, `completedAt: number | null`, `reportPath: string | null`
- Implementation: `src/main/report-service.ts` (new), plus changes to `output-parser.ts`, `ipc-handlers.ts`, `src/preload/index.ts`, and `src/renderer/components/TaskCard.tsx`

### 3.12 Governance / Approval System

- Default permissions: allowFileWrite=true, allowBash=true, allowNetworkAccess=false, allowGitPush=false
- Configurable per-task requireApprovalFor patterns: `git push`, `rm -rf`, `npm publish`, `deploy`
- Real-time detection via regex patterns in output parser
- Yellow approval modal with approve/deny buttons
- Deny sends Ctrl+C to cancel the command
- Decisions logged to tool log

### 3.13 Notification System

- In-memory ring buffer (last 100 notifications)
- Bell icon with unread count badge
- Dropdown with last 20 notifications
- Types: needs-input, completed, error, approval-needed
- Click notification to focus project
- Mark all read

### 3.14 Git Integration

- Auto git init for non-git directories on project add
- Auto-detect default branch (works with main, master, or any branch)
- Git worktree creation per task (isolated in `.bigide-worktrees/`)
- Auto-commit uncommitted agent work on Mark Done / View Diff
- Unified diff between base branch and task branch
- Diff stats parsing
- Git merge
- Worktree removal on cleanup
- GitHub repo creation via `gh` CLI
- PR creation via Octokit with agent summary as body

### 3.15 Error Handling & UX Polish

- Inline error messages on task cards for all actions (Start, Merge, PR, Cleanup)
- Inline error message in task creation modal
- Buttons disabled during async operations (prevents double-click)
- Stale "running" tasks auto-reset to "error" on app restart
- ResizeObserver error suppressed
- Branch name collision prevention (random suffix)
- Windows path separator handling
- ErrorBoundary for React render errors

---

## 4. What Has NOT Been Implemented

### 4.1 From Osmani's Vision

| Feature | Description | Why It Matters |
|---------|-------------|---------------|
| **Async-first execution model** | Agents should run in background without requiring UI presence; user defines intent and reviews later | Currently tasks can run while you're on another tab, but the UI assumes presence; no "fire and forget" mode |
| **Structured plan review before execution** | Before execution, agents should show their plan/breakdown; users approve the plan before running | Agents execute directly after clicking Start; no plan review gate |
| **Cross-project observability dashboard** | Unified view of all agents' progress, costs, status across all projects | Only per-project views exist; no aggregate dashboard |
| **CI/CD status integration** | The IDE should show CI pipeline status inline after PR creation | BigIDE creates PRs but doesn't track whether CI passes or fails |
| **Multi-stage approval workflows** | Approval at multiple stages: plan → implementation → merge, not just binary approve/deny | Current governance is reactive and binary (approve/deny a specific action) |
| **Agent-to-agent handoff** | One agent finishing and explicitly handing off to another (frontend → backend → QA) | Tasks are independent; no dependency or handoff mechanism |
| **Persistent intent provenance** | Store the original agent intent/context for later reference and review reconstruction | Only stores raw prompt; no layered context or "why" metadata |
| **Replay / re-run capability** | Re-run a task with the same prompt but different model, or with tweaked parameters | No replay; must manually create a new task |
| **Cost tracking per agent** | Aggregate LLM token costs by task, project, model | Output parser detects some token patterns but doesn't aggregate |

### 4.2 From Theo's Vision

| Feature | Description | Why It Matters |
|---------|-------------|---------------|
| **Unified multi-project viewport** | All projects visible and accessible without losing context when zooming in | Canvas view and project view are two separate modes; entering a project hides the canvas |
| **Real embedded Chromium browser** | Full browser, not iframe; can run OAuth flows, interact with private repos | BrowserPanel uses iframe which can't do OAuth, has limited cookie/session support |
| **Infinitely zoomable spatial canvas** | 2D workspace like a map; zoom into a project to see its tasks, zoom into a task to see its terminal/diff | React Flow canvas has basic zoom but no semantic nesting (can't zoom into a project card) |
| **Horizontal scrolling / multi-layout** | Multiple workspace layers open simultaneously; scroll between them | Only one ProjectView at a time; can't view two projects side by side |
| **Project-scoped browser and terminal tabs** | Switching projects automatically switches terminal and browser context | Terminal tabs show all tasks regardless of which project is focused; browser is generic |
| **Terminal + editor spatial grouping** | Panels grouped by project with visual continuity | Panels are split regions, not project-grouped spatial elements |
| **Worktree management UI** | Native UI for creating, switching, and comparing worktrees | Worktrees are created automatically but there's no UI to browse, switch, or manage them manually |

### 4.3 Not In Either Vision But Potentially Valuable

| Feature | Description |
|---------|-------------|
| **Code editor integration** | No embedded code editor (Monaco / CodeMirror); users must use external editors for manual edits |
| **Test runner integration** | No built-in test execution or test result display |
| **Database / API explorer** | No tools for inspecting databases, API endpoints, or backend services |
| **Collaboration features** | Single-user only; no multi-user or team features |
| **Plugin / extension system** | No way to extend BigIDE with custom panels, agents, or integrations |
| **Keyboard shortcut system** | Only Escape (back to canvas) and Ctrl+N (add project); minimal keyboard navigation |
| **Search across projects** | No global search across project files or task history |
| **Task templates** | No way to save and reuse common task prompts |
| **Dark/light theme toggle** | Dark theme only; no user preference |

---

## 5. Detailed Comparison: Osmani's Vision vs BigIDE

### Osmani's Five Infrastructure Patterns

```
Pattern                        Osmani's Vision              BigIDE Status
─────────────────────────────────────────────────────────────────────────
1. Git-worktree isolation      Core requirement             ✅ Implemented
                               Each agent in own worktree   Auto-created per task
                                                            Auto-committed on review

2. Task-state boards           Replace file browsers        ✅ Implemented
                               Kanban as primary nav        5-column kanban board
                                                            Status-driven action buttons

3. Background/async-first      Agents run without presence  ⚠️ Partial
                               User reviews later           Agents run in PTY but UI
                                                            assumes real-time monitoring
                                                            No "fire and forget" mode

4. Attention routing           Badges, notifications        ✅ Implemented
                               "Agent needs you"            Notification bell + badges
                                                            INPUT badge on task cards
                                                            Auto-tab switching by status

5. Lifecycle integration       Issues → PRs → CI → merge   ⚠️ Partial
                               Not just editing             PR creation works
                                                            GitHub repo auto-creation
                                                            Missing: CI status tracking
                                                            Missing: issue linking
```

### Osmani's Failure Modes

```
Failure Mode                   Osmani's Concern             BigIDE's Mitigation
──────────────────────────────────────────────────────────────────────────────
"90% correct, subtly broken"   Agents produce plausible     Diff viewer for line-by-line
                               but buggy code               review. But no plan review
                                                            gate to catch intent mismatch
                                                            before execution.

Review fatigue                 12 agents = 12 diffs to      Summary panel reduces review
                               verify without context       burden. But no cross-project
                                                            dashboard to prioritize what
                                                            needs attention first.

Governance surface             Agents with deploy access    Governance modal with
                               create security risk         approve/deny. But reactive
                                                            (command already sent before
                                                            modal appears). Not preventive.
```

---

## 6. Detailed Comparison: Theo's Vision vs BigIDE

### Theo's Six Design Principles

```
Principle                      Theo's Vision                BigIDE Status
─────────────────────────────────────────────────────────────────────────
1. One level higher            Wrap ALL projects, not       ⚠️ Partial
                               just one at a time           Canvas shows all projects
                                                            But entering one hides others
                                                            Two separate modes, not one
                                                            unified viewport

2. Embedded browser +          No mental linking between    ⚠️ Partial
   terminal + orchestration    terminal, editor, browser    Terminal: ✅ (xterm.js)
                                                            Browser: ⚠️ (iframe, not full)
                                                            Editor: ❌ (not embedded)
                                                            Orchestration: ✅ (task board)

3. Infinitely zoomable         2D spatial workspace         ⚠️ Partial
   canvas                      Zoom out = all projects      React Flow canvas exists
                               Zoom in = one project        But no semantic nesting
                               Zoom deeper = task details   Can't zoom into a project card
                                                            to see its tasks inline

4. Multi-project worktree      Worktrees as first-class     ⚠️ Partial
   management                  UI primitive                 Auto-created on task creation
                                                            Auto-removed on cleanup
                                                            But no UI to browse, switch,
                                                            or compare worktrees manually

5. Agent-aware orchestration   Multiple agents visible,     ✅ Implemented
                               status tracking, lifecycle   Multi-agent support
                               management                   Status tracking per task
                                                            Terminal per agent
                                                            Tool log per agent

6. Unified workspace           IDE adapts as you move       ⚠️ Partial
                               between codebases            Project-level context exists
                                                            But terminal/browser don't
                                                            auto-scope to active project
```

---

## 7. Features BigIDE Has That Neither Vision Explicitly Mentions

| Feature | Implementation | Value |
|---------|---------------|-------|
| **Session report generation** | `report-service.ts` generates a self-contained HTML receipt per task; saved to `.bigide-reports/`; opened via cyan "Report" button on task cards | Permanent, shareable audit trail of every agent session without leaving the app |
| **Granular per-task permissions** | TaskPermissions with 4 boolean flags + requireApprovalFor list, configurable in task creation modal | Fine-grained security control per task, not just per project |
| **Auto git init** | Project add handler checks `git.checkIsRepo()`, runs `git init` + initial commit if not a repo | Zero-friction onboarding; user just points at any folder |
| **Auto-commit agent work** | `autoCommitWorktree()` runs `git add . && git commit` before diff or review | Ensures agent file writes are captured even if agent doesn't commit |
| **GitHub repo creation from UI** | `createGitHubRepo()` uses `gh repo create` via CLI | Full GitHub workflow without leaving BigIDE |
| **Branch auto-slugification with collision prevention** | Title → kebab-case + random 4-char suffix | Prevents "branch already exists" errors on repeated tasks |
| **Model picker UI** | Dropdown: Gemini CLI, Claude Code, Codex, Copilot, Custom | User chooses agent per task without config files |
| **Structured tool logging** | ToolLogEntry with timestamp, tool type, args, result, filesAffected | Machine-readable audit trail of agent actions |
| **Inline error messages on task cards** | `safeAction` wrapper catches errors, displays on card | Users see what went wrong without checking console |
| **Stale task recovery on restart** | Running tasks auto-reset to error with explanation on app start | No zombie tasks after crash or restart |
| **Worktree recreation on retry** | `task:start` checks if worktree path exists, recreates if missing | Retry flow works even after worktree was cleaned up |
| **Terminal clipboard support** | Ctrl+C (copy with selection), Ctrl+V (paste), Ctrl+A (select all) | Users can copy agent output |
| **Local file server for preview** | `file-server.ts` serves worktree as HTTP on localhost | Preview HTML/CSS/JS output in embedded browser |

---

## 8. Architectural Differences

### Primary UI Metaphor

```
                Osmani                 Theo                   BigIDE
                ──────                 ────                   ──────
                Control plane          Spatial canvas         Dual mode
                (dashboards +          (2D map,               (canvas overview +
                observability)         infinite zoom)         focused project view)
```

### Unit of Work

```
                Osmani                 Theo                   BigIDE
                ──────                 ────                   ──────
                Agent task             Agent task in          AgentTask tied to
                                       multi-project          Project via projectId
                                       context
```

### Where Review Happens

```
                Osmani                 Theo                   BigIDE
                ──────                 ────                   ──────
                Orchestration          Embedded in IDE        ProjectView with
                dashboard (diffs,      spatially              diff/summary/log panels
                approvals)                                    + governance modal
```

### Async Model

```
                Osmani                 Theo                   BigIDE
                ──────                 ────                   ──────
                Background execution   Parallel agents        Agents run in PTYs
                User checks back       visible in             UI subscribes to output
                later                  workspace              streams in real-time
                                                              No true background mode
```

### State Machine

```
                Osmani                 Theo                   BigIDE
                ──────                 ────                   ──────
                Not detailed           Not detailed           Explicit:
                (emphasis on                                  todo → running →
                observability)                                needs-review → done
                                                              └→ error → (retry)
```

### Tech Stack

```
Layer           Osmani                 Theo                   BigIDE
─────           ──────                 ────                   ──────
Desktop         Conductor (Electron)   T3 Code, Semox         Electron 35
UI              Dashboards (any)       Not specified          React 19 + TailwindCSS
State           Not specified          Not specified          Zustand
Terminal        Embedded terminals     Embedded terminals     xterm.js + node-pty
VCS             Git worktrees          Git worktrees          simple-git + worktrees
Communication   Implied                Implied                Electron IPC (24 channels)
Persistence     Not specified          Not specified          electron-store (JSON)
```

---

## 9. Known Bugs Fixed During This Phase

### Phase 1: UI Testing (Browser-Based) — 3 bugs

| # | Bug | Fix |
|---|-----|-----|
| 1 | Infinite re-render loop in ProjectView | Used `useTaskStore.getState().loadTasks()` + stable `EMPTY_TASKS` constant |
| 2 | Same `|| []` pattern in TaskBoard | Changed to `?? EMPTY` |
| 3 | Stores calling `window.bigide` before preload ready | Added `typeof window !== 'undefined' && window.bigide` guard |

### Phase 2: Full Codebase Audit — 18 issues

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 4 | Missing permissions default | Critical | Added `taskData.permissions ?? DEFAULT_PROJECT_PERMISSIONS` |
| 5 | False "needs input" on startup | Critical | Added 3-second grace period in output parser |
| 6 | Terminal input dies after agent stops | Critical | Added `terminal:write` IPC channel for direct PTY write |
| 7 | Windows path separator breaks project name | Critical | Changed `split('/')` to `split(/[\\/]/)` |
| 8 | Worktree failure silently continues | High | Now throws error with user-visible message |
| 9 | Merge doesn't update task status | High | Added status update + IPC push after merge |
| 10 | `generateAgentSummary` never called | High | Called on completion in output parser |
| 11 | `getDiffStats` never called | High | Called before summary generation |
| 12 | Error patterns too aggressive | High | Tightened regexes |
| 13 | Cleanup leaves ghost tasks | High | Now removes from persistent store |
| 14 | Completion pattern "done" too broad | Medium | Added line-start anchor |
| 15 | Terminal tabs vanish on completion | Medium | Include needs-review and error tasks |
| 16 | View Log on error doesn't switch tab | Medium | Added error → log case |
| 17 | defaultBranch hardcoded to 'main' | Medium | Auto-detect via git branchLocal() |
| 18 | Added Discard button to needs-review | UX | Cleanup handler on review tasks |

### Phase 3: Post-Audit Fixes — 14 issues

| # | Bug | Fix |
|---|-----|-----|
| 19 | ResizeObserver crash replacing entire UI | Suppressed in error handler; removed innerHTML nuke |
| 20 | Branch name collisions | Random 4-char suffix appended |
| 21 | Task creation errors invisible | Inline error display in modal |
| 22 | All action errors invisible | safeAction wrapper with inline display on cards |
| 23 | Stale running tasks after restart | Auto-reset to error on startup |
| 24 | Retry broken (worktree missing) | task:start recreates worktree |
| 25 | Error tasks can't be removed | Added Discard button to error tasks |
| 26 | Buttons clickable during async | Busy state disables buttons |
| 27 | PR URL not visible | Shown on task card |
| 28 | Gemini CLI model name wrong | Removed -m flag, use default |
| 29 | Gemini CLI one-shot mode | Changed to `-i` interactive mode |
| 30 | Review button missing on error tasks | Added Review button |
| 31 | Agent files not committed → empty diff | Auto-commit on Mark Done / View Diff |
| 32 | Summary empty on manual Mark Done | Generate summary + diff stats on status transition |

---

## 10. Known Limitations (Architectural)

| # | Limitation | Impact | Why Not Fixed |
|---|-----------|--------|---------------|
| 1 | **Governance is reactive, not preventive** | When `rm -rf` is detected, the command may have already completed. Deny sends Ctrl+C after the fact. | Architectural: PTY-based output parsing sees output after execution. True interception would require modifying the agent's permission system. |
| 2 | **"Always allow" checkbox does nothing** | GovernanceModal checkbox state is tracked but never persisted or sent to main process. | Would require extending the permissions model. Left as placeholder. |
| 3 | **No branch name validation** | Users can type invalid git branch names with spaces or special characters. | Worktree creation now throws a clear error, so the user gets feedback. |
| 4 | **Double notification subscription** | Both `useNotifications` hook and `notification-store` subscribe to `onNotification`. | `useNotifications` is not mounted. Latent bug only if someone imports it. |
| 5 | **Browser panel uses iframe, not webview** | Iframe can't do OAuth, has limited session support, can't access `file://` protocol. | Electron webview had `GUEST_VIEW_MANAGER_CALL` errors on localhost. Iframe works for local preview. |
| 6 | **Tool log patterns don't match Gemini CLI output** | Gemini CLI's output format differs from Claude Code's. Tool detection regex captures noise. | Would need Gemini-specific output parsing patterns. |
| 7 | **No embedded code editor** | Users must use external editors (VS Code, etc.) for manual edits. | Out of scope for v0.1; would significantly increase complexity. |
| 8 | **Single-user, single-machine** | No collaboration, no remote execution, no team features. | Desktop-first design decision. Remote/team mode would require client-server rewrite. |

---

## 11. Prioritized Feature Roadmap

### Tier 1: Complete the Core Workflow (High Impact, Medium Effort)

| Priority | Feature | Aligns With | Effort |
|----------|---------|------------|--------|
| 1 | **Cross-project observability dashboard** — unified view of all agents' status, costs, attention needs | Osmani | Medium |
| 2 | **Unified multi-project viewport** — keep canvas context visible while working in a project (split view or picture-in-picture) | Theo | Medium |
| 3 | **Structured plan review before execution** — parse agent plans, display for approval before running | Osmani | Medium |
| 4 | **CI/CD status integration** — show GitHub Actions status inline on PR tasks | Osmani | Medium |
| 5 | **Project-scoped terminal and browser tabs** — auto-switch context when clicking different projects | Theo | Medium |

### Tier 2: Strengthen Governance and Review (Medium Impact, Low-Medium Effort)

| Priority | Feature | Aligns With | Effort |
|----------|---------|------------|--------|
| 6 | **Multi-stage approval workflow** — plan → implementation → merge gates | Osmani | Medium |
| 7 | **Persistent intent provenance** — store "why" with tasks, not just the prompt | Osmani | Low |
| 8 | **Cost/token aggregation** — sum LLM costs by task, project, model | Osmani | Low |
| 9 | **Task replay / re-run** — re-run with different model or tweaked prompt | Both | Medium |
| 10 | **Gemini CLI output patterns** — agent-specific output parsing | Neither | Low |

### Tier 3: Spatial IDE Improvements (High Impact, High Effort)

| Priority | Feature | Aligns With | Effort |
|----------|---------|------------|--------|
| 11 | **Infinite zoom + semantic nesting** — zoom into project → see tasks → zoom into task → see terminal/diff | Theo | High |
| 12 | **Real embedded Chromium browser** — replace iframe with full browser for OAuth, sessions, devtools | Theo | High |
| 13 | **Horizontal multi-project layout** — view two projects side by side | Theo | Medium |
| 14 | **Worktree management UI** — browse, switch, compare worktrees | Theo | Medium |

### Tier 4: Advanced / Future (Enables New Patterns)

| Priority | Feature | Aligns With | Effort |
|----------|---------|------------|--------|
| 15 | **Agent-to-agent handoff** — task dependencies, sequential agent workflows | Osmani | High |
| 16 | **Async "fire and forget" mode** — define intent, close BigIDE, review later | Osmani | Medium |
| 17 | **Embedded code editor** — Monaco/CodeMirror for manual edits without leaving BigIDE | Theo | High |
| 18 | **Plugin / extension system** — custom panels, agents, integrations | Neither | Very High |
| 19 | **Headless / remote mode** — run BigIDE on a server, access via web | Osmani | Very High |
| 20 | **Live diff annotations** — "Agent changed this because..." with confidence scores | Osmani | High |

---

## 12. Summary Alignment Table

```
Dimension                    Osmani    Theo     BigIDE    Gap
───────────────────────────────────────────────────────────────────
Multi-project orchestration  Implicit  Core     Partial   Unified viewport needed
Embedded browser             —         Core     Iframe    Real Chromium needed
Embedded terminal            Assumed   Core     Done      ✅
Async-first execution        Core      —        Partial   Background mode needed
Governance/approval          Core      —        Done      ✅ (reactive, not preventive)
Observability dashboard      Core      —        Per-proj  Cross-project needed
Git worktrees                Core      Core     Done      ✅
Task state board             Core      —        Done      ✅
Review-first interface       Core      —        Done      ✅
Infinite zoom                —         Core     Limited   Semantic nesting needed
Spatial grouping             —         Core     Partial   Better layout needed
Plan review gate             —         —        Missing   New feature (high value)
Lifecycle (CI/CD)            Core      —        Partial   CI status needed
Agent-to-agent handoff       Mentioned —        Missing   Future feature
Cost tracking                Mentioned —        Missing   Low effort to add
Code editor                  —         Implied  Missing   High effort
Plugin system                —         —        Missing   Future feature
```

**Overall alignment: ~60% of both visions implemented. The foundation (Electron, React, Zustand, git worktrees, IPC architecture) is correct and extensible. The gaps are primarily in cross-project visibility, spatial UX, and lifecycle integration.**

---

*This checkpoint was generated during the BigIDE v0.1.0 development phase. For implementation details, see `docs/ARCHITECTURE.md`. For the full bug list, see `TESTING_REPORT.md`.*
