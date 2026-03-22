# BigIDE: Vision vs Reality

**Date:** 2026-03-21
**Version:** 0.1.0
**Status:** Prototype — functional end-to-end workflow

---

## Purpose

This document compares BigIDE's current implementation against the two reference visions that inspired it: Addy Osmani's "control plane" thesis and Theo Browne's "bigger IDE" thesis. It identifies what has been achieved, what is missing, and where BigIDE has made its own architectural choices. This is for developers and stakeholders who want to understand the project's alignment with its intellectual foundations.

For implementation details, see `docs/ARCHITECTURE.md`. For the full bug history, see `TESTING_REPORT.md`. For current implementation status, see `docs/DEVELOPMENT_CHECKPOINT.md`.

---

## Table of Contents

1. [Addy Osmani's Vision — "The IDE Is Being De-Centered"](#1-addy-osmanis-vision--the-ide-is-being-de-centered)
2. [Theo Browne's Vision — "We Need a Bigger IDE"](#2-theo-brownes-vision--we-need-a-bigger-ide)
3. [Where BigIDE Goes Beyond Both Visions](#3-where-bigide-goes-beyond-both-visions)
4. [Architectural Comparison](#4-architectural-comparison)
5. [Alignment Summary](#5-alignment-summary)
6. [Recommended Next Steps](#6-recommended-next-steps)

---

## 1. Addy Osmani's Vision — "The IDE Is Being De-Centered"

### 1.1 Core Thesis

The IDE is not dying — its center of gravity is shifting from the text editor to orchestration dashboards and control planes. The editor becomes one subordinate instrument among several. What changes is not what the IDE does, but what it centers: instead of centering the file tree and the cursor, it centers the agent task queue, the diff review surface, the approval workflow, and the lifecycle from issue to merge.

Osmani's vision draws on real deployed tooling (Conductor, Copilot Agent, Cursor Glass, Jules, Vibe KanBan) and identifies patterns that recur across them — not as speculation but as observed convergence.

### 1.2 Five Infrastructure Patterns

Osmani identifies five patterns that appear across every serious agentic IDE. The comparison below maps each to BigIDE's current implementation.

---

#### Pattern 1: Git-Worktree Isolation

```
Osmani's Vision
  Each agent gets its own isolated copy of the codebase via git worktree.
  Agents can run in parallel without stepping on each other's working trees.
  The user never sees merge conflicts mid-task.

BigIDE Implementation   STATUS: DONE
  src/main/git-service.ts → createWorktree()
    - Creates .bigide-worktrees/<branch-name>/ per task
    - Worktree path stored on AgentTask.worktreePath
    - Created before agent launch, removed on cleanup/discard

  src/main/ipc-handlers.ts → task:start handler
    - Checks if worktree exists; recreates if missing (supports retry)

  src/main/git-service.ts → autoCommitWorktree()
    - Runs git add . && git commit before diff or review
    - Ensures agent file writes are captured even if agent doesn't commit

  Worktree cleanup
    - Removed on task:cleanup and task:discard
    - .bigide-worktrees/ path is gitignored

Where BigIDE Goes Further
  BigIDE adds auto-commit on review transition. Osmani's pattern assumes
  the agent commits its own work; BigIDE handles the case where it doesn't.
  BigIDE also adds collision prevention: branch names get a 4-char random
  suffix to avoid "branch already exists" errors.
```

---

#### Pattern 2: Task-State Boards

```
Osmani's Vision
  Kanban boards replace the file browser as the primary navigation surface.
  The developer's view of work is not a file tree but a task queue with
  status transitions. "What are my agents doing?" is the primary question,
  not "what files exist?"

BigIDE Implementation   STATUS: DONE
  src/renderer/components/TaskBoard.tsx
    - 5-column kanban: Todo | Running | Review | Done | Error
    - Columns rendered as vertical stacks of TaskCard components
    - Empty-state messaging per column

  src/renderer/components/TaskCard.tsx
    - Status-driven action buttons: Start, Stop, Mark Done, Merge,
      Create PR, View Diff, View Log, Report, Retry, Discard, Cleanup
    - Buttons disabled during async operations
    - Inline error messages on card (no console required)
    - PR URL displayed on card when available

  src/renderer/stores/task-store.ts
    - State machine transitions enforced in store
    - todo → running → needs-review → done
    - Any state → error → (retry → todo)

Where BigIDE Diverges from Osmani
  None significant. The 5-column board is a natural extension of the
  3-column model (todo/in-progress/done) Osmani describes. The action
  buttons implement the status-driven interaction model he envisions.
```

---

#### Pattern 3: Background / Async-First Execution

```
Osmani's Vision
  Agents run without requiring your presence. The user defines intent
  (prompt, constraints, permissions), submits, and moves on. Review
  happens later, not continuously. The IDE surfaces attention requests
  when they arise, rather than demanding that you watch a terminal.

BigIDE Implementation   STATUS: PARTIAL
  What works:
    src/main/pty-manager.ts
      - Agents run in node-pty PTYs; they continue running if you
        navigate to the canvas view or another project
      - Output is buffered in terminalLog (up to 2000 lines)
      - Notifications fire when status changes (completed, needs-input)

    src/renderer/components/NotificationBar.tsx
      - In-memory ring buffer of last 100 notifications
      - Types: needs-input, completed, error, approval-needed
      - Click to focus the relevant project

  What is missing:
    - No "fire and forget" mode: if you close BigIDE, agents stop
      (PTY lifecycle is tied to Electron process)
    - No background execution without the app open
    - No mobile or remote notification surface
    - The UI assumes you are watching: auto-tab switching (terminal →
      diff → log) implies active presence

Gap Analysis
  BigIDE has async-within-session (you can context-switch between
  projects while agents run) but not async-across-sessions (close
  the app and come back). True background execution would require
  a daemon process or server-side component outside Electron.
```

---

#### Pattern 4: Attention Routing

```
Osmani's Vision
  The IDE knows when an agent needs human input and routes attention
  accordingly. Badges, notifications, and visual signals replace
  continuous terminal monitoring. The human's job is to resolve
  blockers, not to watch output streams.

BigIDE Implementation   STATUS: DONE
  src/renderer/components/NotificationBar.tsx
    - Bell icon in header with unread count badge
    - Dropdown showing last 20 notifications with timestamps
    - Mark all read
    - Click notification → focus that project's view

  src/renderer/components/TaskCard.tsx
    - Yellow "INPUT" badge on cards where agent is waiting
    - Orange "APPROVAL" badge on governance-pending tasks

  src/renderer/components/ProjectView.tsx
    - Auto-tab switching: running → terminal, needs-review → diff,
      error → log
    - Driven by selectedTask state in workspace-store

  src/renderer/stores/notification-store.ts
    - Types: needs-input, completed, error, approval-needed
    - Triggered by output-parser.ts pattern matching on PTY output

Where BigIDE Diverges from Osmani
  None significant. The implementation closely mirrors what Osmani
  describes. The INPUT badge and notification bell together implement
  his "agent needs you" routing pattern. Auto-tab switching adds an
  additional layer he doesn't explicitly mention.
```

---

#### Pattern 5: Lifecycle Integration

```
Osmani's Vision
  The IDE covers the full lifecycle: issues → tasks → agent execution →
  PR creation → CI/CD tracking → merge. Not just editing. The IDE is the
  control surface for the entire development workflow, including handoff
  to automated systems.

BigIDE Implementation   STATUS: PARTIAL
  What works:
    src/main/git-service.ts
      - createGitHubRepo(): creates GitHub repo via gh CLI if none exists
      - createPullRequest(): pushes branch + creates PR via Octokit
      - PR URL stored on AgentTask and displayed on TaskCard
      - Git merge: merges task branch into base branch

    src/main/ipc-handlers.ts
      - task:create-pr handler orchestrates repo creation + PR creation
      - Uses agent summary as PR body

  What is missing:
    - No CI/CD status tracking: PR is created but BigIDE doesn't poll
      GitHub Actions or display pass/fail status
    - No issue linking: tasks have no connection to GitHub Issues or
      any issue tracker
    - No merge requirements: BigIDE will merge even if CI is failing
    - No automated post-merge workflows

Gap Analysis
  BigIDE covers about 70% of the lifecycle Osmani describes:
  task → execution → PR creation → manual merge.
  The missing 30% is CI status visibility and issue provenance.
  These are medium-effort GitHub API integrations.
```

---

### 1.3 Failure Modes Osmani Identifies

Osmani doesn't just describe what agentic IDEs should do — he identifies the failure modes they must actively prevent. BigIDE's mitigations are assessed here.

---

#### "90% Correct, Subtly Broken"

```
Osmani's Concern
  Agents consistently produce code that looks correct at a glance but
  has subtle bugs: wrong API version, off-by-one, missing edge case.
  The human must reconstruct the agent's intent before they can evaluate
  whether the output is actually right. This demands deep re-engagement
  with the codebase, defeating the purpose of delegation.

BigIDE's Mitigations
  src/renderer/components/DiffPanel.tsx
    - Full unified diff, file-by-file navigation
    - Color-coded additions (green) and deletions (red)
    - Stats bar: files changed, insertions, deletions
    - Sticky file headers for navigation in large diffs

  src/renderer/components/AgentSummaryPanel.tsx
    - Auto-generated summary on completion
    - Groups files created vs modified
    - Lists bash commands run
    - Shows original prompt for intent comparison

  src/main/report-service.ts
    - Self-contained HTML report per task
    - Full terminal transcript (ANSI-cleaned)
    - Tool log timeline, diff, governance decisions, timestamps

Remaining Gap
  BigIDE has no plan review gate before execution. Osmani envisions
  the agent proposing a plan (files it will touch, actions it will take)
  and the user approving before any code is written. BigIDE's agents
  execute immediately on Start. Intent mismatch is only catchable in
  post-execution review, not pre-execution.
```

---

#### Review Fatigue

```
Osmani's Concern
  Twelve parallel agents means twelve diffs to verify. Verifying code
  you didn't write demands reconstructing intent. The overhead of review
  becomes a new bottleneck replacing the overhead of writing.

BigIDE's Mitigations
  src/renderer/components/AgentSummaryPanel.tsx
    - Structured summary reduces "reconstruct intent" work
    - Shows what the agent did, not just what changed

  src/renderer/components/ToolLogPanel.tsx
    - Timeline of every tool call: file edits, bash commands, reads
    - Filter by tool type to focus review
    - Args and results visible per entry

Remaining Gap
  BigIDE has per-project views but no cross-project observability
  dashboard. If you have agents running on 5 projects, there is no
  single screen showing all 5 agents' progress, which tasks need
  attention, or which are in an error state. The canvas view shows
  project nodes but not agent status at a glance.
```

---

#### Governance Surface

```
Osmani's Concern
  Agents with filesystem writes, web access, and deploy triggers expand
  the security surface dramatically. Governance must be first-class, not
  bolted on. The IDE must be the authorization layer for agent actions.

BigIDE's Mitigations
  src/renderer/components/GovernanceModal.tsx
    - Yellow approval modal with Approve/Deny buttons
    - Triggered by real-time pattern matching on PTY output
    - Deny sends Ctrl+C to cancel the command

  src/main/governance-service.ts
    - Per-task permission flags: allowFileWrite, allowBash,
      allowNetworkAccess, allowGitPush
    - requireApprovalFor: configurable list of command patterns
      (git push, rm -rf, npm publish, deploy)
    - Decisions logged to tool log

  src/renderer/components/TaskCreateModal.tsx
    - Permissions configurable per task at creation time

Remaining Gap (Architectural)
  BigIDE's governance is reactive, not preventive. The pattern detector
  sees agent output after the PTY has already executed the command. By
  the time the approval modal appears, rm -rf may have already run.
  True preventive governance would require intercepting agent tool calls
  at the SDK level, not at the output stream level. This is an
  architectural constraint of the PTY-based approach.

  Additionally, the "Always allow" checkbox in GovernanceModal is
  rendered but non-functional: the state is tracked but never persisted
  or sent to the main process.
```

---

### 1.4 What BigIDE Implements That Osmani Envisions

- Git worktree isolation per agent task
- Task-state kanban board as primary navigation (5 columns)
- Status-driven action buttons (start, review, merge, create PR)
- In-app attention routing (notification bell, INPUT badge, auto-tab switching)
- Per-task permission flags (allowFileWrite, allowBash, allowNetworkAccess, allowGitPush)
- Governance approval modal with pattern-based trigger
- Unified diff viewer for review
- Agent summary to reduce review reconstruction overhead
- PR creation with agent summary as body
- GitHub repo auto-creation from within the IDE
- Structured tool log as audit trail
- Self-contained session report per task

### 1.5 What BigIDE Is Missing From Osmani's Vision

- **Background execution model**: Agents stop when the app closes. No daemon, no remote execution, no push notifications out-of-band.
- **Plan review gate**: No pre-execution plan approval. Agents execute immediately on Start.
- **Cross-project observability dashboard**: No aggregate view of all agents' status across all open projects.
- **CI/CD status integration**: BigIDE creates PRs but does not display GitHub Actions results or block merge on CI failure.
- **Issue linking**: Tasks have no connection to GitHub Issues or any external issue tracker. There is no provenance chain from ticket to PR.
- **Multi-stage approval**: Governance is binary (approve/deny one action) not staged (approve plan, approve implementation, approve merge).
- **Agent-to-agent handoff**: Tasks are independent. No dependency graph, no "when task A finishes, start task B on the result."
- **Preventive governance**: Approval modal appears after command execution, not before. PTY output parsing is inherently reactive.
- **Cost tracking**: Output parser detects some token patterns but does not aggregate LLM costs by task, project, or model.
- **Task replay**: No mechanism to re-run a task with the same prompt but a different model or with modified parameters.

---

## 2. Theo Browne's Vision — "We Need a Bigger IDE"

### 2.1 Core Thesis

The agentic IDE is fundamentally a developer operating system that orchestrates multiple parallel projects simultaneously. Not smaller (CLI-only), not the traditional VS Code fork. The problem Theo identifies is cognitive: when you run agents in parallel on repos A, B, and C simultaneously, having separate terminal windows, separate VS Code windows, and separate browser tabs for each creates unbearable mental context-switching overhead. The work of navigating your tools exceeds the work of building. The solution is a single unified spatial workspace that contains everything — terminal, browser, orchestration, editor — and adapts as you move between codebases.

Theo's honest caveat: "Nobody has figured this out yet." BigIDE is an early attempt.

### 2.2 Six Design Principles

---

#### Principle 1: One Level Higher

```
Theo's Vision
  The IDE must wrap ALL your projects, not open one at a time. It
  operates one abstraction level above the individual project: you
  see relationships between projects, dependencies, parallel work.
  Switching between projects should not involve switching mental contexts.

BigIDE Implementation   STATUS: PARTIAL
  src/renderer/components/canvas/CanvasView.tsx
    - React Flow canvas showing all open projects as draggable nodes
    - Task nodes attached to project nodes with status indicators
    - MiniMap for navigation when many projects are open
    - Zoom and pan controls
    - Hover X to remove projects, + button to add via file picker

  src/renderer/components/canvas/ProjectNode.tsx
    - Shows project name, path, task count
    - Click to enter ProjectView (focused mode)

  src/renderer/components/canvas/TaskNode.tsx
    - Status badge per task, attached to project node

  App.tsx
    - Two modes: canvas (all projects) and project (one project)
    - Controlled by workspace-store.selectedProjectId

Gap
  Canvas and ProjectView are two separate modes. When you click into
  a project, the canvas disappears entirely. Theo envisions a unified
  viewport where all projects remain visible while you work inside one.
  This would require either a split view (canvas panel + project panel)
  or a picture-in-picture canvas overlay while in project mode. Neither
  exists currently.
```

---

#### Principle 2: Embedded Browser, Terminal, and Orchestration in One App

```
Theo's Vision
  No mental linking between "this terminal → VS Code window → GitHub
  tab → localhost:3000 tab." Everything lives in one app. The developer's
  cognitive model is unified: the tool is the IDE, not a set of
  externally coordinated apps.

BigIDE Implementation   STATUS: PARTIAL
  Terminal   STATUS: DONE
    src/renderer/components/TerminalPanel.tsx
      - xterm.js with GitHub Dark theme, JetBrains Mono
      - FitAddon for auto-resizing, WebLinksAddon for URLs
      - Clipboard: Ctrl+C/V/A
      - 5000-line scrollback
      - Persists for running, review, error, done tasks

  Browser   STATUS: PARTIAL
    src/renderer/components/BrowserPanel.tsx
      - Embedded iframe (not full Chromium)
      - src/main/file-server.ts serves worktree files via HTTP
      - URL bar with back/forward/reload
      - MIME support: HTML, CSS, JS, JSON, images, fonts, SVG
    Limitation: iframe cannot do OAuth flows, has limited
    cookie/session support, cannot access external domains with
    restrictive CSP headers

  Orchestration   STATUS: DONE
    src/renderer/components/TaskBoard.tsx
    src/renderer/components/PanelLayout.tsx
      - Task board + tabbed panels in split layout
      - Panels: Terminal, Browser, Diff, Log, Summary

  Code Editor   STATUS: MISSING
    No embedded editor (Monaco, CodeMirror). Users must use an
    external editor (VS Code, etc.) for manual code modifications.

Gap
  Two of the three core embedded components (terminal, orchestration)
  are working. The browser is functional for local preview but not
  for real web interaction. The editor is absent entirely, which means
  a full developer workflow still requires leaving BigIDE.
```

---

#### Principle 3: Infinitely Zoomable Canvas

```
Theo's Vision
  A 2D spatial workspace like a map. Zoom out to see all projects.
  Zoom in to see tasks attached to a project. Zoom in further to see
  a task's terminal, diff, and logs inline. Panels can be split and
  rearranged arbitrarily. The spatial metaphor reduces cognitive load
  because location carries meaning.

BigIDE Implementation   STATUS: PARTIAL
  src/renderer/components/canvas/CanvasView.tsx
    - React Flow canvas with drag, zoom, pan
    - Pinch/scroll zoom (standard React Flow behavior)
    - MiniMap (React Flow built-in)
    - ProjectNode and TaskNode as React Flow node types

  What is missing:
    - No semantic nesting: you cannot zoom into a ProjectNode to see
      its tasks rendered inline within it
    - You cannot zoom into a TaskNode to see the terminal/diff/log
    - Zoom changes the scale of the canvas but not the information
      density — you don't get more detail by zooming in
    - No spatial grouping that persists: dragging nodes rearranges them
      but doesn't create project/task hierarchies

Gap
  BigIDE has the mechanics (React Flow zoom/pan) but not the semantics
  (nested spatial content). Implementing semantic nesting would require
  React Flow's custom node renderer to conditionally show expanded
  content at certain zoom levels, similar to how Figma's canvas shows
  frame contents when zoomed in.
```

---

#### Principle 4: Multi-Project Worktree Management as First-Class Primitive

```
Theo's Vision
  Creating and switching git worktrees should be built into the IDE as
  a first-class interaction, not a manual terminal operation. The
  developer should be able to see all active worktrees, switch between
  them, and understand which agent is working in which worktree.

BigIDE Implementation   STATUS: PARTIAL
  src/main/git-service.ts
    - createWorktree(): creates .bigide-worktrees/<branch-name>/
    - removeWorktree(): cleans up on task discard/cleanup
    - autoCommitWorktree(): commits agent writes before review
    - Worktree path stored on AgentTask.worktreePath

  src/main/ipc-handlers.ts
    - Worktree auto-created when task starts
    - Recreated on retry if it was previously cleaned up

  What is missing:
    - No worktree browser UI: no panel showing "here are your current
      worktrees and their status"
    - No manual worktree creation: users can't create a worktree for
      a branch that isn't associated with a BigIDE task
    - No worktree comparison: no UI to diff two worktrees against each
      other
    - Worktree path is only visible in TaskCard if you inspect the task
      data; it is not surfaced in the UI

Gap
  Worktrees are infrastructure (auto-created, auto-removed) but not
  a UI primitive. Theo's vision requires them to be visible and
  navigable — the user should understand the worktree graph.
```

---

#### Principle 5: Agent-Aware Orchestration

```
Theo's Vision
  The IDE understands that multiple agents are running simultaneously.
  It shows each agent's status, lets you review outputs, manages task
  lifecycle, and treats agent management as a core function — not a
  plugin or add-on.

BigIDE Implementation   STATUS: DONE
  src/renderer/components/TaskBoard.tsx
    - All tasks visible with status badges simultaneously
    - Multiple agents can run in parallel (each has its own PTY)
    - Status updates in real-time via IPC push events

  src/main/pty-manager.ts
    - One PTY per task, keyed by taskId
    - Independent lifecycle: start, stop, cleanup

  src/renderer/components/TerminalTabs.tsx
    - One terminal tab per task (running, review, error, done)
    - Click tab to focus that agent's output

  src/renderer/components/ToolLogPanel.tsx
    - Per-task structured log of every tool call
    - Filter by tool type

  src/renderer/stores/task-store.ts
    - Full state machine per task: todo → running → needs-review →
      done, with error branch and retry path

Where BigIDE Aligns With Theo
  This is the strongest alignment point. The per-task terminal,
  per-task tool log, per-task state machine, and simultaneous
  multi-agent support all directly implement what Theo envisions.
```

---

#### Principle 6: Unified Workspace with Flexible Adaptation

```
Theo's Vision
  As you move between codebases, the IDE adapts. The terminal switches
  to that project's directory. The browser switches to that project's
  localhost. The editor context switches to that project's files.
  The workspace is unified but not undifferentiated — it knows where
  you are and adapts accordingly.

BigIDE Implementation   STATUS: PARTIAL
  src/renderer/stores/workspace-store.ts
    - selectedProjectId and selectedTaskId track current context
    - ProjectView receives project and task as props

  Agent is launched in worktree directory
    - PTY cwd is set to task.worktreePath in agent-launcher.ts
    - Each agent's terminal is scoped to its worktree

  src/renderer/components/BrowserPanel.tsx
    - file-server.ts serves the task's worktree directory
    - Preview button loads index.html from worktree

  What doesn't auto-scope:
    - Terminal tabs show ALL tasks regardless of which project is active
    - There is no concept of "switch to project B → terminal shows
      project B's tasks"
    - Browser URL doesn't change automatically when you switch projects
    - No persistent per-project browser state (URLs, scroll positions)

Gap
  The individual components are scoped per task, but the act of
  switching projects doesn't trigger a coordinated context switch
  across terminal + browser + orchestration. They each require manual
  navigation.
```

---

### 2.3 What BigIDE Implements That Theo Envisions

- Multi-project canvas overview (React Flow, all projects visible simultaneously)
- Embedded terminal per agent task (xterm.js + node-pty)
- Embedded browser with local file server for preview
- Agent-aware orchestration: multi-agent support, per-task state machine, per-task terminal tabs
- Task-level status tracking with real-time updates
- Git worktree automation (creation, commit, cleanup)
- Review-first interface (diff + summary + log panels)
- Zoom and pan canvas navigation

### 2.4 What BigIDE Is Missing From Theo's Vision

- **Unified viewport**: Canvas and ProjectView are separate modes. Entering a project hides the canvas.
- **Real embedded Chromium browser**: BrowserPanel uses an iframe, not a full Chromium instance. OAuth flows, cross-origin requests, and browser devtools are unavailable.
- **Code editor**: No embedded editor. Users must use an external editor for manual code changes.
- **Infinitely zoomable semantic canvas**: React Flow zoom changes scale but not information density. Cannot zoom into a ProjectNode to see its tasks inline.
- **Horizontal multi-project layout**: No side-by-side project views. Only one ProjectView is visible at a time.
- **Worktree management UI**: Worktrees are auto-created but not browsable. No UI to inspect, compare, or manually manage worktrees.
- **Project-scoped context switching**: Switching projects does not automatically switch terminal context, browser URL, or panel state.
- **Spatial grouping**: Panels are split regions (left board, right tabs), not spatial elements grouped by project.

---

## 3. Where BigIDE Goes Beyond Both Visions

Neither Osmani nor Theo explicitly describes the following features. BigIDE implements them as practical necessities discovered during development.

| Feature | Implementation | Why It Matters |
|---------|---------------|----------------|
| **Session report generation** | `src/main/report-service.ts` generates a self-contained HTML receipt per task. Saved to `.bigide-reports/` in the project directory. Cyan "Report" button on task cards. | Permanent, shareable audit trail. The report contains the full diff, tool log, terminal transcript, governance decisions, and timestamps — without requiring BigIDE to be open. |
| **Granular per-task permissions** | `TaskPermissions` with 4 boolean flags (`allowFileWrite`, `allowBash`, `allowNetworkAccess`, `allowGitPush`) + `requireApprovalFor` pattern list. Configurable in `TaskCreateModal.tsx`. | Security control at the task level, not just the project level. A "read-only analysis" task can have all writes disabled. |
| **Auto git init for any folder** | `git-service.ts` checks `git.checkIsRepo()` on project add; runs `git init` + initial commit if not a repo. | Zero-friction onboarding. Users can point BigIDE at any folder without pre-configuring git. |
| **Auto-commit agent work before review** | `autoCommitWorktree()` in `git-service.ts` runs before diff generation or review. | Agents frequently write files without committing. Without this, the diff viewer would show nothing. |
| **GitHub repo creation from UI** | `createGitHubRepo()` uses `gh repo create` via CLI shell-out. Invoked automatically during PR creation if no remote exists. | Full GitHub workflow without leaving BigIDE. Users don't need to manually create repos. |
| **Branch name collision prevention** | Task title → kebab-case + 4-char random alphanumeric suffix. | Prevents "a branch named X already exists" worktree errors when running similar tasks repeatedly. |
| **Model picker UI** | Dropdown in `TaskCreateModal.tsx`: Gemini CLI, Claude Code, Codex, GitHub Copilot, Custom. | Per-task model selection without config files or CLI flags. Users can compare models on the same task. |
| **Structured tool logging** | `ToolLogEntry` (timestamp, tool type, args, result, filesAffected). Real-time via `task:tool-logged` IPC event. Displayed in `ToolLogPanel.tsx` with filter buttons. | Machine-readable audit trail independent of terminal output. Survives ANSI stripping and terminal clear sequences. |
| **Inline error messages on task cards** | `safeAction` wrapper in `TaskCard.tsx` catches errors and displays them inline on the card. | Users see what failed without opening DevTools or checking logs. Prevents silent failure on merge, PR creation, cleanup. |
| **Stale task recovery on app restart** | `index.ts` resets all `running` tasks to `error` on startup with explanation message. | No zombie tasks after crash or force-quit. Users see that tasks were interrupted, not that they disappeared. |
| **Worktree recreation on retry** | `task:start` handler checks if `worktreePath` exists; recreates it if missing. | Retry works even after the worktree was cleaned up by a previous failed attempt. |
| **Terminal clipboard support** | Ctrl+C (copy when text selected), Ctrl+V (paste), Ctrl+A (select all) in `TerminalPanel.tsx`. | Users can copy agent output for external use without leaving the terminal panel. |
| **Local file server for preview** | `src/main/file-server.ts` serves the task's worktree as HTTP on localhost. Auto-serves `index.html` on Preview click. | Lets the embedded iframe browser load local files. Necessary because `file://` protocol is blocked in iframes. |
| **ANSI code stripping in reports** | Terminal transcript in session report has ANSI escape sequences stripped for readable HTML. | Raw PTY output is unreadable in HTML. Reports are clean and shareable. |

---

## 4. Architectural Comparison

### 4.1 Primary UI Metaphor

```
                Osmani                  Theo                    BigIDE
                ──────                  ────                    ──────
                Control plane           Spatial canvas          Dual mode
                (dashboards,            (2D map,                (canvas overview
                observability,          infinite zoom,          when idle,
                approval flows)         spatial nesting)        focused project
                                                                view when working)

The fundamental tension: Osmani prioritizes observability and control.
Theo prioritizes spatial coherence and unified context. BigIDE is both,
but in sequence: you observe from canvas, then enter to control.
The gap is that the transition loses the canvas context.
```

### 4.2 Unit of Work

```
                Osmani                  Theo                    BigIDE
                ──────                  ────                    ──────
                Agent task              Agent task in           AgentTask record
                (abstract)              multi-project           tied to Project
                                        context                 via projectId,
                                                                with worktreePath,
                                                                branchName, model,
                                                                permissions, logs
```

### 4.3 Where Review Happens

```
                Osmani                  Theo                    BigIDE
                ──────                  ────                    ──────
                Orchestration           Embedded in IDE         ProjectView with
                dashboard               spatially near          tabbed panels:
                (separate from          the project             DiffPanel,
                execution surface)      context                 AgentSummaryPanel,
                                                                ToolLogPanel,
                                                                + GovernanceModal
                                                                overlaid on top
```

### 4.4 Async Model

```
                Osmani                  Theo                    BigIDE
                ──────                  ────                    ──────
                Background execution    Parallel agents         Agents run in
                User defines intent,    visible in              node-pty PTYs
                closes IDE, comes       workspace               in-process.
                back to review          simultaneously          App must stay
                results                                         open for agents
                                                                to continue.
                                                                No fire-and-forget.
```

### 4.5 State Machine

```
                Osmani                  Theo                    BigIDE
                ──────                  ────                    ──────
                Not specified           Not specified           Explicit 5-state
                (emphasis on            (emphasis on            machine per task:
                observability)          spatial layout)
                                                                todo
                                                                 │ start
                                                                 ▼
                                                                running
                                                                 │ complete/
                                                                 │ mark-done
                                                                 ▼
                                                                needs-review
                                                                 │ merge
                                                                 ▼
                                                                done
                                                                 │
                                                                 ▼ (any state)
                                                                error
                                                                 │ retry
                                                                 ▼
                                                                todo
```

### 4.6 Tech Stack

```
Layer           Osmani                  Theo                    BigIDE
─────           ──────                  ────                    ──────
Desktop         Conductor (Electron)    T3 Code, Semox          Electron 35
UI framework    Dashboards (any)        Not specified           React 19 + TailwindCSS 4
State           Not specified           Not specified           Zustand (4 stores)
Terminal        Embedded terminals      Embedded terminals      xterm.js + node-pty
Canvas          Not mentioned           Implied (Excalidraw-    React Flow
                                        style spatial)
VCS             Git worktrees           Git worktrees           simple-git + worktrees
IPC             Implied                 Implied                 24 Electron IPC channels
                                                                (contextBridge)
Persistence     Not specified           Not specified           electron-store (JSON)
Agent support   Conductor, Jules,       T3 Code, Semox          Gemini CLI, Claude Code,
                Copilot Agent           (implied custom)        Codex, Copilot, Custom
```

---

## 5. Alignment Summary

The table below covers every dimension identified across both visions. Symbols indicate alignment between the reference vision's intent and BigIDE's current implementation.

```
Symbols:
  ✅  Aligned     — BigIDE implements this well
  ⚠️   Partial    — BigIDE has a version of this with meaningful gaps
  ❌  Missing     — BigIDE does not implement this
  ➕  Beyond      — BigIDE implements this; neither vision mentions it
  —   Not stated  — Vision does not address this dimension

Dimension                      Osmani    Theo      BigIDE    Status
───────────────────────────────────────────────────────────────────────────────
Git worktree isolation         Core      Core      Done      ✅ Aligned
Task-state kanban board        Core      —         Done      ✅ Aligned
Attention routing              Core      —         Done      ✅ Aligned
Per-task governance/approval   Core      —         Done      ✅ Aligned (reactive)
Agent-aware orchestration      Core      Core      Done      ✅ Aligned
Embedded terminal              Assumed   Core      Done      ✅ Aligned
Review interface               Core      —         Done      ✅ Aligned
Diff viewer                    Core      —         Done      ✅ Aligned
PR creation                    Core      —         Done      ✅ Aligned
GitHub repo creation           —         —         Done      ➕ Beyond
Auto git init                  —         —         Done      ➕ Beyond
Auto-commit agent work         —         —         Done      ➕ Beyond
Session report (HTML receipt)  —         —         Done      ➕ Beyond
Per-task permission flags      —         —         Done      ➕ Beyond
Branch collision prevention    —         —         Done      ➕ Beyond
Model picker UI                —         —         Done      ➕ Beyond
Structured tool logging        —         —         Done      ➕ Beyond
Inline error messages          —         —         Done      ➕ Beyond
Stale task recovery            —         —         Done      ➕ Beyond
Terminal clipboard support     —         —         Done      ➕ Beyond
Local file server for preview  —         —         Done      ➕ Beyond
Multi-project canvas           —         Core      Partial   ⚠️ Partial
Embedded browser               —         Core      Partial   ⚠️ Partial (iframe only)
Async/background execution     Core      —         Partial   ⚠️ Partial (in-session only)
Lifecycle (CI/CD)              Core      —         Partial   ⚠️ Partial (no CI status)
Infinite zoom + nesting        —         Core      Partial   ⚠️ Partial (no nesting)
Worktree management UI         —         Core      Partial   ⚠️ Partial (auto only)
Unified project viewport       —         Core      Partial   ⚠️ Partial (two modes)
Project-scoped context switch  —         Core      Partial   ⚠️ Partial (manual)
Cross-project dashboard        Core      —         Missing   ❌ Missing
Plan review gate               Core      —         Missing   ❌ Missing
CI/CD status integration       Core      —         Missing   ❌ Missing
Issue linking                  Core      —         Missing   ❌ Missing
Agent-to-agent handoff         Mentioned —         Missing   ❌ Missing
Cost/token tracking            Mentioned —         Missing   ❌ Missing
Task replay/re-run             —         —         Missing   ❌ Missing
Code editor (embedded)         —         Implied   Missing   ❌ Missing
Horizontal multi-proj layout   —         Core      Missing   ❌ Missing
Multi-stage approval           Core      —         Missing   ❌ Missing
Plugin/extension system        —         —         Missing   ❌ Missing
Persistent intent provenance   Core      —         Missing   ❌ Missing
```

**Overall alignment: approximately 60% of both visions implemented.**

The foundation — Electron, React, Zustand, git worktrees, node-pty, IPC architecture — is correct and extensible. The gaps are primarily in:
- Cross-project visibility (Osmani's observability tier)
- Spatial UX completeness (Theo's canvas tier)
- Lifecycle integration past PR creation (Osmani's CI/CD tier)

---

## 6. Recommended Next Steps

Gaps are prioritized by effort-to-alignment ratio: fixes that close the largest conceptual gaps with the least implementation work are listed first.

---

### Quick Wins (Low Effort, High Alignment)

These close real gaps in the vision alignment without requiring architectural changes.

**1. Persistent intent provenance on tasks**
Add a `contextNotes` field to `AgentTask` (stored in `store.ts`). Surface it in `TaskCreateModal.tsx` as an optional "Why?" text area. Display in `AgentSummaryPanel.tsx` and in session reports. Addresses Osmani's "reconstruct intent" problem directly.
_Effort: 1-2 days. Files: `shared/types.ts`, `store.ts`, `TaskCreateModal.tsx`, `AgentSummaryPanel.tsx`, `report-service.ts`_

**2. Cost / token aggregation**
`output-parser.ts` already detects some token patterns. Add a `tokenUsage: { input: number; output: number }` field to `AgentTask`. Aggregate in `AgentSummaryPanel.tsx` and session reports. Addresses Osmani's cost tracking gap.
_Effort: 1 day. Files: `output-parser.ts`, `shared/types.ts`, `AgentSummaryPanel.tsx`_

**3. Gemini CLI output pattern tuning**
Add Gemini-specific completion and tool detection patterns to `output-parser.ts`. Currently tool log patterns are tuned for Claude Code's output format and produce noise on Gemini CLI. This is the most common agent, so this affects primary workflows.
_Effort: 1-2 days. Files: `output-parser.ts`, `tool-log-service.ts`_

**4. Fix "Always allow" in GovernanceModal**
Wire the checkbox state in `GovernanceModal.tsx` to persist in the task's `permissions.requireApprovalFor` list. When checked, remove that pattern from future approval triggers. Addresses Osmani's governance surface concern.
_Effort: 0.5 days. Files: `GovernanceModal.tsx`, `governance-service.ts`, `ipc-handlers.ts`_

**5. Task replay / re-run**
Add a "Retry with new model" button to done/error tasks in `TaskCard.tsx`. Pre-fill `TaskCreateModal.tsx` with the original task's prompt, title, and permissions. Addresses both visions' implicit need for iteration.
_Effort: 1 day. Files: `TaskCard.tsx`, `TaskCreateModal.tsx`, `task-store.ts`_

---

### Medium-Term (Medium Effort, Significant Alignment Improvement)

These require more design and implementation work but close major conceptual gaps.

**6. Cross-project observability dashboard**
Add a new view accessible from the canvas: a status table showing all tasks across all projects, sorted by urgency (needs-input, error, running, review, done). Show agent status, time running, and attention needs at a glance. This is Osmani's "control plane" in its clearest form.
_Effort: 3-5 days. New component: `DashboardView.tsx`. Data aggregation in `workspace-store.ts`._

**7. Unified viewport (keep canvas visible in project view)**
Add a collapsible mini-canvas panel in the left sidebar of `ProjectView.tsx`. When expanded, shows a miniaturized version of the canvas (React Flow MiniMap-style) while you work in the project. Clicking another project switches context without losing orientation. Directly addresses Theo's "one level higher" principle.
_Effort: 3-5 days. Files: `ProjectView.tsx`, `PanelLayout.tsx`, `CanvasView.tsx` (extract mini mode)._

**8. CI/CD status integration**
After PR creation, poll GitHub API for Actions run status on the PR's head SHA. Display a status badge on the `TaskCard.tsx` in done/review state: pending (yellow), passing (green), failing (red). Block or warn on merge if CI is failing. Addresses Osmani's lifecycle gap.
_Effort: 3-4 days. Files: `git-service.ts` (add GitHub API polling), `ipc-handlers.ts`, `TaskCard.tsx`._

**9. Project-scoped terminal context**
When `selectedProjectId` changes in `workspace-store.ts`, the terminal tab list should filter to show only that project's tasks. Add a project-scoped filter to `TerminalTabs.tsx`. This is a significant UX improvement for multi-project workflows.
_Effort: 1-2 days. Files: `TerminalTabs.tsx`, `workspace-store.ts`._

**10. Structured plan review gate**
Before executing on Start, attempt to extract a plan from the agent's first N lines of output (many agents output a plan before acting). Pause execution (send agent a "wait for approval" prompt), display the plan in a modal, and let the user approve or abort. This is Osmani's most-mentioned missing feature in BigIDE.
_Effort: 5-7 days. This is architecturally complex because it requires agent-specific output parsing and a two-phase PTY interaction. Files: `output-parser.ts`, `ipc-handlers.ts`, new `PlanReviewModal.tsx`._

---

### Long-Term (High Effort, Transformative)

These require significant architectural work but would make BigIDE a qualitatively different tool.

**11. Semantic zoom and nested canvas**
Extend `CanvasView.tsx` with zoom-level-aware rendering: at low zoom, show project nodes; at medium zoom, expand project nodes to show task nodes inline; at high zoom, show task details (status, last output line, diff preview) inside the task node. Requires custom React Flow node renderers and zoom threshold logic. Directly implements Theo's infinite canvas vision.
_Effort: 2-3 weeks. Files: `CanvasView.tsx`, `ProjectNode.tsx`, `TaskNode.tsx`, new `TaskDetailNode.tsx`._

**12. Real embedded Chromium browser**
Replace the iframe in `BrowserPanel.tsx` with an Electron `<webview>` tag (resolve the current `GUEST_VIEW_MANAGER_CALL` errors by enabling `nodeIntegration: false` + `webviewTag: true` in the BrowserWindow). This enables OAuth flows, devtools, full session support. Alternatively, open a secondary BrowserWindow as a managed child. This is necessary for Theo's "no mental linking" vision to be complete.
_Effort: 1-2 weeks. Files: `BrowserPanel.tsx`, `main/index.ts` (window config)._

**13. Horizontal multi-project layout**
Allow two `ProjectView` instances side by side. This requires lifting the single `selectedProjectId` pattern in `workspace-store.ts` to support `[leftProjectId, rightProjectId]`. `PanelLayout.tsx` would need a split mode. This directly addresses Theo's multi-project simultaneous visibility need.
_Effort: 1-2 weeks. Files: `workspace-store.ts`, `PanelLayout.tsx`, `ProjectView.tsx`, `App.tsx`._

**14. Agent-to-agent handoff and task dependencies**
Add a `dependsOn: string[]` field to `AgentTask`. When a task completes, check if any other tasks list it as a dependency and auto-start them. Add a dependency picker in `TaskCreateModal.tsx`. Implement a simple dependency graph view in `CanvasView.tsx` (edges between task nodes). This enables Osmani's "frontend → backend → QA" sequential workflow.
_Effort: 2-3 weeks. Files: `shared/types.ts`, `store.ts`, `task-store.ts`, `ipc-handlers.ts`, `TaskCreateModal.tsx`, `CanvasView.tsx`._

**15. Async background execution (daemon mode)**
Extract the agent execution layer (PTY management, output parsing, notifications) into a separate Node.js process or background Electron utility process that persists when the main window is closed. The main window connects to the daemon on start and receives buffered events. This is the hardest item on this list and would require a significant architectural change to how `pty-manager.ts`, `output-parser.ts`, and the IPC layer are structured.
_Effort: 4-6 weeks. Affects: all of `src/main/`. Would enable Osmani's core "define intent, close the IDE, review later" vision._

---

*For implementation status, see `docs/DEVELOPMENT_CHECKPOINT.md`. For architecture details, see `docs/ARCHITECTURE.md`. Document generated 2026-03-21 for BigIDE v0.1.0.*
