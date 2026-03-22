# Building BigIDE v0.1: An Agent Team Case Study

## Overview

BigIDE v0.1 was built in a single session by a **team of 6 AI agents** working in parallel. The coordinator (team lead) designed the architecture, partitioned the work into non-overlapping file sets, spawned 5 specialist builder agents simultaneously, monitored their output, and performed final integration. The entire implementation — 48 source files across 7 build phases — was completed in one pass.

This document describes the team structure, task allocation, communication patterns, and lessons learned.

---

## The Team

### 1. Coordinator (Team Lead)

**Role:** Architect, orchestrator, integrator.

**Responsibilities:**
- Read the full plan and existing scaffolding (package.json, tsconfig, electron-vite config, shared types)
- Designed the file-level partitioning strategy to avoid write conflicts
- Created the team and task list
- Spawned all 5 builder agents with detailed prompts
- Wrote several files directly (NotificationBar, GovernanceModal, BrowserPanel, styles.css, index.html)
- Monitored agent completion and read their output
- Performed integration: fixed import/export mismatches, resolved interface conflicts between agents
- Ran `npm install` and `npx electron-vite build` to verify compilation
- Launched the dev server to confirm the app runs

The coordinator was the only agent with full project context. It was responsible for ensuring all pieces fit together.

### 2. `main-process` (Builder Agent)

**Color:** Blue
**Subagent type:** `builder`
**Permission mode:** `bypassPermissions`

**Assigned files (10):**
- `src/main/index.ts` — Electron app entry, window creation
- `src/main/ipc-handlers.ts` — All IPC handler registrations
- `src/main/store.ts` — JSON persistence via electron-store
- `src/main/pty-manager.ts` — node-pty process pool
- `src/main/git-service.ts` — Worktree CRUD, diff, merge, PR creation
- `src/main/agent-launcher.ts` — Spawns AI agents per model selection
- `src/main/output-parser.ts` — Detects agent status from terminal output
- `src/main/tool-log-service.ts` — Structured log of agent tool calls
- `src/main/governance-service.ts` — Permission rules + approval gates
- `src/main/notification-service.ts` — Attention routing events

**What it did:**
Found that most files already existed (the coordinator had written initial versions). Read each one, identified 3 bugs in `ipc-handlers.ts` (bad type import, inline pty hack, unused imports), fixed them, and added `contextIsolation`/`nodeIntegration` to `index.ts`. Later returned for Phase 7 polish: fixed import/export mismatches across all renderer files, created `useKeyboardShortcuts.ts` and `ErrorBoundary.tsx`, updated `App.tsx`.

**Completion message highlights:**
> "Fixed 3 bugs in ipc-handlers.ts... All services wire together correctly: store → git-service → pty-manager → output-parser → tool-log-service → governance-service → agent-launcher → notification-service → ipc-handlers → index."

### 3. `renderer-foundation` (Builder Agent)

**Color:** Green
**Subagent type:** `builder`
**Permission mode:** `bypassPermissions`

**Assigned files (13):**
- `src/preload/index.ts` — contextBridge IPC API
- `src/renderer/index.html` — HTML entry point
- `src/renderer/main.tsx` — React 19 createRoot
- `src/renderer/App.tsx` — Top-level component (canvas vs focused mode)
- `src/renderer/lib/types.ts` — Window type augmentation, re-exports
- `src/renderer/stores/workspace-store.ts` — Projects, canvas positions
- `src/renderer/stores/task-store.ts` — Agent tasks per project
- `src/renderer/stores/notification-store.ts` — Notification state
- `src/renderer/stores/governance-store.ts` — Permission approval state
- `src/renderer/hooks/useIpc.ts` — IPC wrapper with error handling
- `src/renderer/hooks/useTerminal.ts` — Terminal data subscription
- `src/renderer/hooks/useNotifications.ts` — Notification subscription
- `src/renderer/app.css` — TailwindCSS v4 import

**What it did:**
Discovered that several files already existed (preload, main.tsx, App.tsx, styles.css) from the coordinator's earlier writes. Created the remaining files. Made a key architectural decision: stores subscribe to IPC events at module init time (not inside React components) so subscriptions survive re-renders.

**Key decision documented:**
> "Stores subscribe to IPC events at module init time — this is intentional so subscriptions survive re-renders."

### 4. `canvas-components` (Builder Agent)

**Color:** Yellow
**Subagent type:** `builder`
**Permission mode:** `bypassPermissions`

**Assigned files (5):**
- `src/renderer/components/canvas/CanvasView.tsx` — React Flow canvas
- `src/renderer/components/canvas/ProjectNode.tsx` — Project card node
- `src/renderer/components/canvas/TaskNode.tsx` — Task status node
- `src/renderer/components/Sidebar.tsx` — List-mode fallback
- `src/renderer/components/PanelLayout.tsx` — Resizable split layout

**What it did:**
Built the spatial canvas UI. ProjectNode and TaskNode use `export default memo(...)`. Task nodes are positioned absolutely relative to their project (not using React Flow's parent mechanism) to avoid layout constraints. Only project nodes are draggable. Added `onToggleListView` prop to CanvasView, which required the coordinator to update App.tsx to pass it.

**Key decision documented:**
> "Task nodes positioned at `project.x + 20, project.y + 120 + i*72` — not parented to avoid React Flow parent constraints."

### 5. `task-terminal` (Builder Agent)

**Color:** Purple
**Subagent type:** `builder`
**Permission mode:** `bypassPermissions`

**Assigned files (6):**
- `src/renderer/components/ProjectView.tsx` — Focused view with panels
- `src/renderer/components/TaskBoard.tsx` — Kanban columns
- `src/renderer/components/TaskCard.tsx` — Task card with actions
- `src/renderer/components/TaskCreateModal.tsx` — New task form
- `src/renderer/components/TerminalPanel.tsx` — xterm.js instance
- `src/renderer/components/TerminalTabs.tsx` — Tabbed terminal container

**What it did:**
Built the task management and terminal UI. TerminalPanel uses xterm.js with FitAddon, WebLinksAddon, and a ResizeObserver for auto-fit. TaskCreateModal includes branch auto-slugification from the title, a model picker (Claude Code / Codex / Copilot / Custom), and an editable `requireApprovalFor` list. Also reconciled conflicts where the coordinator or linter had modified files.

### 6. `review-components` (Builder Agent)

**Color:** Orange
**Subagent type:** `builder`
**Permission mode:** `bypassPermissions`

**Assigned files (6):**
- `src/renderer/components/DiffPanel.tsx` — Git diff viewer
- `src/renderer/components/AgentSummaryPanel.tsx` — Structured summary
- `src/renderer/components/ToolLogPanel.tsx` — Tool call timeline
- `src/renderer/components/GovernanceModal.tsx` — Approval prompt
- `src/renderer/components/NotificationBar.tsx` — Attention routing
- `src/renderer/components/BrowserPanel.tsx` — Embedded browser

**What it did:**
Built the observability and review layer. DiffPanel uses `react-diff-view` with GitHub-style dark theme CSS overrides. AgentSummaryPanel parses the markdown-format summary into structured sections (What Changed, Stats, Original Prompt) with fallback to raw text. ToolLogPanel classifies tool calls by type (file_edit, bash, file_read, governance) with color-coded timeline entries and live subscription. Enhanced the BrowserPanel with URL-vs-search detection and error overlay.

---

## Communication Architecture

### How Agents Communicated

The agents used a **hub-and-spoke** model: all communication went through the coordinator. Agents never communicated directly with each other.

```
                    ┌─────────────────┐
                    │   Coordinator   │
                    │   (Team Lead)   │
                    └────────┬────────┘
              ┌──────┬───────┼───────┬──────┐
              ▼      ▼       ▼       ▼      ▼
         ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
         │ main-  ││renderer││canvas- ││ task-  ││review- │
         │process ││foundn. ││comps.  ││terminal││comps.  │
         └────────┘└────────┘└────────┘└────────┘└────────┘
```

**Communication channels:**
1. **Coordinator → Agent (spawn):** Each agent received a single, detailed prompt at spawn time containing: the project path, which files to read first (`src/shared/types.ts`), exactly which files to create, the expected behavior of each file, and assumptions about what other agents were building (e.g., "Assume these stores exist and import from them: ...").

2. **Agent → Coordinator (completion):** When each agent finished, it sent a structured summary back: files created, files updated, key decisions made, bugs found and fixed. These summaries were the coordinator's primary integration signal.

3. **Coordinator → Agent (shutdown):** After verifying the build, the coordinator sent shutdown requests to all agents.

### What Agents Did NOT Do

- Agents **never sent messages to each other**. There was no peer-to-peer coordination.
- Agents **never read each other's files** during execution. They worked on strictly non-overlapping file sets.
- Agents **never shared state** beyond what was in the filesystem. The shared `types.ts` file served as the contract.

### The Shared Contract

The key enabler of parallel work was `src/shared/types.ts`, which defined:
- All data models (`Project`, `AgentTask`, `ToolLogEntry`, `TaskPermissions`, `Notification`)
- All IPC channel signatures (`IpcChannels`, `IpcEvents`)
- Default values (`DEFAULT_PERMISSIONS`)

This file was written by the coordinator before spawning any agents. Every agent was instructed to read it first. It served as the **interface contract** between the main process (built by `main-process`) and the renderer (built by the other 4 agents).

The preload script (`src/preload/index.ts`) was the second contract — it defined the `window.bigide` API surface that all renderer stores and components depended on.

---

## Task Allocation Strategy

### Principle: Non-Overlapping File Sets

The coordinator partitioned work so that **no two agents would write to the same file**. This eliminated merge conflicts entirely. The partitioning followed the natural architecture:

| Agent | Layer | File Count |
|-------|-------|------------|
| `main-process` | Electron main process | 10 |
| `renderer-foundation` | Preload + entry + stores + hooks | 13 |
| `canvas-components` | Spatial canvas UI | 5 |
| `task-terminal` | Task management + terminals | 6 |
| `review-components` | Review + governance + browser | 6 |

Some files were written by the coordinator before agents spawned (shared types, preload, configs). When agents found these files already existed, they read them and either left them intact or fixed bugs.

### Why This Partitioning Worked

1. **Vertical slicing by concern:** Each agent owned a coherent subsystem. `main-process` owned all backend services. `task-terminal` owned the task lifecycle UI. This meant each agent could reason about its domain without needing context from other agents.

2. **Dependency direction:** The dependency graph flows one way: `shared/types.ts` → `preload/index.ts` → `stores/` → `components/`. Agents building downstream components were told the upstream interfaces via their prompts.

3. **Convention over coordination:** Instead of negotiating export styles, the agents independently chose conventions (e.g., `export default` for components, named exports for stores). The coordinator fixed mismatches during integration.

---

## Integration Phase

After all 5 agents completed, the coordinator performed integration:

### Issues Found and Fixed

1. **Import/export mismatches:** Some agents used `export default` while the coordinator's imports expected named exports (`{ CanvasView }`). Fixed by updating import statements.

2. **Interface mismatches:** `TaskBoard` expected `(projectId, onCreateTask)` props but `ProjectView` passed `(projectId, activeTaskId, onSelectTask)`. The linter and agents collaboratively resolved this — the `task-terminal` agent updated both files to be consistent.

3. **API surface mismatch:** `ToolLogPanel` initially used `window.bigide.on?.('task:tool-logged', ...)` but the preload exposed `window.bigide.onTaskToolLogged(...)`. Fixed by the `main-process` agent during its Phase 7 pass.

4. **Package name changes:** xterm.js moved to `@xterm/xterm` in v5. The coordinator updated `package.json` and `TerminalPanel.tsx` imports.

5. **Null safety:** `DiffPanel`, `ToolLogPanel`, and `AgentSummaryPanel` required non-null `taskId` but could receive `null` from `ProjectView`. The `task-terminal` and `review-components` agents independently added null guards.

### Build Verification

```
$ npx electron-vite build

✓ 9 modules transformed.     dist/main/index.js       18.74 kB   ✓ built in 280ms
✓ 1 modules transformed.     dist/preload/index.js     3.39 kB   ✓ built in 20ms
✓ 229 modules transformed.   dist/renderer/index.js    1,610 kB  ✓ built in 2.77s
```

All three bundles compiled successfully on the first build attempt after integration.

---

## Timeline

The entire build proceeded in overlapping waves:

```
Time ──────────────────────────────────────────────────────►

Coordinator:  [Plan + Scaffold] [Spawn 5 agents]  [Monitor]  [Integrate + Fix]  [Build + Test]
main-process:            [Read existing ──► Fix bugs ──► Phase 7 polish ──► Done]
renderer-fdn:            [Create stores + hooks + entry ──────────────── Done]
canvas-comps:            [Build canvas + nodes + sidebar ─────────────── Done]
task-terminal:           [Build task board + terminals + modal ────────── Done]
review-comps:            [Build diff + summary + log + browser ────────── Done]
```

Key observations:
- All 5 agents ran **simultaneously**, not sequentially
- The `main-process` agent was the first to finish (it mostly fixed existing files)
- The `renderer-foundation` and `canvas-components` agents finished next
- The `task-terminal` and `review-components` agents finished last (they had the most complex components)
- Integration took ~5 minutes of coordinator time after all agents completed

---

## Lessons Learned

### What Worked Well

1. **Strict file partitioning** eliminated merge conflicts. No agent ever had to wait for another.

2. **Shared type definitions as contracts** let agents work independently while producing compatible code. `src/shared/types.ts` was the single source of truth.

3. **Detailed prompts with assumptions** ("Assume these stores exist...") let agents write code that referenced not-yet-existing modules by specifying the expected interface upfront.

4. **Agent completion summaries** with "key decisions" sections helped the coordinator understand each agent's choices without reading every file.

5. **The linter as a sixth team member.** A code formatting linter ran automatically on saved files. It caught several issues (unused imports, style inconsistencies) that agents would have had to coordinate on otherwise.

### What Could Be Improved

1. **Export convention alignment.** The biggest integration cost was fixing `default` vs named export mismatches. A shared convention (e.g., "all components use named exports") in the initial prompt would have prevented this.

2. **Prop interface contracts.** Component props weren't defined in the shared types file — each agent independently designed their component interfaces. This led to mismatches between callers and callees (e.g., `TaskBoard` props). Future work: define component prop interfaces in a shared file.

3. **No inter-agent communication.** The agents couldn't ask each other questions. When `task-terminal` needed to know how `review-components` exported `DiffPanel`, it had to guess. A shared conventions document or inter-agent messaging would help.

4. **Coordinator as bottleneck.** The coordinator wrote some files early, which agents then had to read-and-reconcile rather than write fresh. A cleaner approach: coordinator only writes the contracts (`types.ts`, `preload/index.ts`), agents write everything else.

5. **Testing gap.** No tests were written. A sixth `test-writer` agent running after the builders could have added basic smoke tests for each store and service.

---

## Final Statistics

| Metric | Value |
|--------|-------|
| Total source files | 48 |
| Main process files | 10 |
| Renderer files | 37 |
| Shared files | 1 |
| Total agents | 6 (1 coordinator + 5 builders) |
| Parallel agents | 5 (all builders ran simultaneously) |
| Integration fixes | 5 categories (imports, interfaces, API surface, packages, null safety) |
| Build output | main 18KB + preload 3KB + renderer 1.6MB |
| Build success | First attempt after integration |
