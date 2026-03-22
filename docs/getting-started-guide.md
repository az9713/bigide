# BigIDE Getting Started Guide

Build a Python app, review it, and ship it to GitHub — all from one window.

This walkthrough takes you from an empty folder to a pushed GitHub PR using BigIDE's agent orchestration features. Each section introduces the feature you'll use at that step.

---

## Prerequisites

- **Git** installed and configured (`git config --global user.name` / `user.email`)
- **GitHub CLI** (`gh`) authenticated — run `gh auth status` to verify
- **Claude Code CLI** installed — run `claude --version` to verify
- A GitHub repository (can be empty) to push to

---

## Step 1: Add Your Project

**Feature: Multi-Project Workspace**

BigIDE manages multiple projects from a single window. The **Canvas View** is your bird's-eye view of everything you're working on.

1. Launch BigIDE
2. You land on the **Canvas** — a zoomable, pannable space where each project is a draggable card
3. Click **"+ Add Project"** in the toolbar
4. A native directory picker opens — select your project folder (or create a new empty folder like `my-python-app`)
5. Your project appears as a **node on the canvas**

> **Tip:** You can drag project nodes to arrange them spatially. Positions are saved between sessions. Zoom with scroll wheel, pan by dragging the background.

If you haven't initialized git yet, open a terminal (see Step 3) and run:

```bash
git init
git remote add origin https://github.com/yourname/my-python-app.git
```

---

## Step 2: Enter Focused View

**Feature: Canvas → Focused Mode Navigation**

The canvas gives you the overview. To work inside a project, you drill down.

1. **Double-click** your project node on the canvas
2. You enter **Focused View** — a panel-based workspace for that single project

The focused view has:

| Area | Location | Purpose |
|------|----------|---------|
| **Back to Canvas** | Top-left | Return to the bird's-eye view |
| **Task Board** | Left panel (30%) | Kanban board for agent tasks |
| **Right Panel** | Right side (70%) | Tabbed area with Terminal, Browser, Diff, Log, Summary |

These panels are **resizable** — drag the divider between them.

---

## Step 3: Create Your First Agent Task

**Feature: Task Board (Kanban) + Model Selection + Permissions**

Instead of typing code yourself, you describe what you want and assign it to an AI agent.

1. In the Task Board, click **"+ New Task"**
2. The **Task Create Modal** appears with these fields:

| Field | What to enter | Why |
|-------|--------------|-----|
| **Title** | `Create flask hello-world app` | Human-readable name shown on the kanban card |
| **Branch Name** | `feat/flask-app` | BigIDE creates a git branch + worktree with this name |
| **Prompt** | See below | The instruction sent to the AI agent |
| **Model** | `claude-code` (default) | Which AI agent to use. Options: `claude-code`, `codex`, `copilot`, `custom` |
| **Permissions** | Leave defaults | Controls what the agent is allowed to do |

**Example prompt:**

```
Create a simple Python Flask application with:
- app.py with a / route returning "Hello, World!" and a /health route returning JSON {"status": "ok"}
- requirements.txt with flask pinned to a recent version
- A basic test file tests/test_app.py using pytest
- A .gitignore for Python projects
```

3. Click **"Create"**

### What happens behind the scenes

**Feature: Git Worktree Isolation**

BigIDE doesn't just create a branch — it creates a **git worktree**. This is a separate checkout of your repo in its own directory, so the agent works in complete isolation:

```
my-python-app/                  ← your main checkout (untouched)
my-python-app/.bigide-worktrees/
  └── feat/flask-app/           ← agent works here, isolated
```

This means you (or another agent) can keep working on `main` while this agent works on `feat/flask-app`. No conflicts, no stashing, no switching branches.

Your new task appears in the **Todo** column of the kanban board.

---

## Step 4: Start the Agent

**Feature: Agent Orchestration + Embedded Terminal**

1. Click your task card in the Todo column
2. Click the **"Start"** button on the card
3. The task moves to the **Running** column with a pulsing blue dot

BigIDE spawns a terminal in the worktree directory and launches the agent. Switch to the **Terminal** tab in the right panel to watch it work in real time.

You'll see the agent:
- Reading your codebase to understand context
- Creating files (`app.py`, `requirements.txt`, `tests/test_app.py`, `.gitignore`)
- Possibly running `pip install` and `pytest` to verify its work

### What you can do while the agent works

- **Watch the terminal** — see every command and file edit in real time
- **Switch to another project** — click "← Canvas" to go back and start work elsewhere
- **Create more tasks** — add a second task in the same project (each gets its own worktree)
- **Do nothing** — the agent runs asynchronously; you'll be notified when it's done

---

## Step 5: Monitor Agent Status

**Feature: Attention Routing (Notifications)**

BigIDE watches the agent's terminal output and detects status changes automatically:

| What happens | What you see |
|-------------|-------------|
| Agent is working | Task card shows pulsing blue ● in **Running** column |
| Agent needs your input | Task card shows ⚠, **Notification Bar** at top alerts you |
| Agent finishes | Task moves to **Needs Review** column, notification appears |
| Agent hits an error | Task moves to **Error** column with red ● |

The **Notification Bar** at the top of the window shows attention items across all projects — click one to jump directly to that task's terminal.

**Feature: Tool Log (Observability)**

Switch to the **Log** tab in the right panel to see a structured timeline of what the agent did:

```
10:03:12  [file_edit]   Created app.py                    ✓
10:03:14  [file_edit]   Created requirements.txt           ✓
10:03:15  [file_edit]   Created tests/test_app.py          ✓
10:03:16  [file_edit]   Created .gitignore                 ✓
10:03:18  [bash]        pip install -r requirements.txt    ✓
10:03:25  [bash]        pytest tests/                      ✓
```

You can **filter by tool type** (file edits, bash commands, file reads) using the filter buttons at the top. This is more useful than scrolling through raw terminal output when you want to understand what changed.

---

## Step 6: Handle Governance Prompts

**Feature: Governance / Approval Gates**

If the agent tries to do something restricted by the task's permissions, BigIDE pauses it and shows a **Governance Modal**:

```
┌─────────────────────────────────────────┐
│  ⚠ Agent requests approval              │
│                                         │
│  Task: Create flask hello-world app     │
│  Action: git push                       │
│  Detail: git push origin feat/flask-app │
│                                         │
│  [Deny]                    [Approve]    │
└─────────────────────────────────────────┘
```

By default, actions like `git push`, `rm -rf`, `npm publish`, and `deploy` require your approval. You configured these in the permissions when creating the task.

- **Approve** — the agent continues with the action
- **Deny** — the agent receives a cancellation and must find another approach

All governance decisions (approved and denied) are logged in the **Tool Log** with a `governance` tag.

---

## Step 7: Review the Agent's Work

**Feature: Diff Panel + Agent Summary**

Once the agent finishes (task moves to **Needs Review**), click the task card. BigIDE auto-switches to the **Diff** tab.

### Diff Panel

Shows a full git diff of the agent's branch vs. your default branch, with:

- **File list** on the left — each file marked as Added (A), Modified (M), or Deleted (D)
- **Unified diff** on the right — green for additions, red for deletions
- Click a file name to jump to its diff

### Agent Summary

Switch to the **Summary** tab for a structured overview:

```
## What changed
- Created app.py (new file)
- Created requirements.txt (new file)
- Created tests/test_app.py (new file)
- Created .gitignore (new file)

## Stats
4 files changed, +87 insertions, -0 deletions

## Original prompt
"Create a simple Python Flask application with..."
```

This connects the diff back to the original intent — what Addy Osmani calls **"intent provenance."** When you're reviewing 5 diffs from 5 parallel agents at the end of the day, the summary tells you *why* each change was made, not just *what* changed.

---

## Step 8: Merge the Work

**Feature: Local Merge**

If you're happy with the diff:

1. Click **"Merge"** on the task card (appears for tasks in the **Needs Review** column)
2. BigIDE runs `git merge feat/flask-app` into your default branch
3. The worktree is cleaned up automatically
4. The task moves to the **Done** column ✓

Your main branch now contains the Flask app.

---

## Step 9: Create a Pull Request

**Feature: GitHub PR Creation**

If you prefer a code review workflow instead of merging directly:

1. Click **"Create PR"** on the task card (instead of Merge)
2. BigIDE:
   - Pushes the branch to GitHub (`git push origin feat/flask-app`)
   - Creates a Pull Request via the GitHub API
   - Uses the **Agent Summary** as the PR description
   - Stores the PR URL on the task card

The PR URL appears on the task card as a clickable **[PR]** badge.

### View the PR in the Embedded Browser

**Feature: Embedded Browser**

Switch to the **Browser** tab in the right panel. The PR URL loads right inside BigIDE — no need to switch to your external browser. You can:

- Read the PR diff on GitHub
- Check CI status
- Leave review comments
- Merge from GitHub's UI

The browser has a URL bar, back/forward navigation, and supports any web page (localhost dev servers, documentation, etc.).

---

## Step 10: Clean Up

Once the PR is merged (or you've merged locally):

1. Click **"Cleanup"** on the done task card
2. BigIDE removes the git worktree and cleans up the branch
3. The task disappears from the board

Return to the **Canvas** (click "← Canvas") to see your project node updated — task count badges reflect the current state.

---

## Running Multiple Tasks in Parallel

The real power of BigIDE shows when you run multiple agents simultaneously.

From the Task Board, create several tasks at once:

| Task | Branch | Prompt |
|------|--------|--------|
| Add Docker support | `feat/docker` | "Add a Dockerfile and docker-compose.yml for the Flask app" |
| Add CI pipeline | `feat/ci` | "Add a GitHub Actions workflow that runs pytest on push" |
| Add API docs | `feat/docs` | "Add a README.md with API documentation and setup instructions" |

Start all three. Each gets its own worktree, its own terminal, its own agent. The kanban board shows all three running in parallel:

```
Todo          Running              Review         Done
              ┌──────────────┐
              │ Docker    ●  │
              │ CI        ●  │
              │ API docs  ●  │
              └──────────────┘
```

As each finishes, it moves to the Review column. You review diffs one by one, merge or create PRs, and clean up. The **Notification Bar** tells you which agent needs you next.

Go back to the **Canvas** to check on your other projects — maybe you have agents running there too. This is the orchestration workflow that both Osmani and Theo describe: your job shifts from *writing* code to *directing, reviewing, and merging* agent output.

---

## Feature Reference

| Feature | Where to find it | Keyboard shortcut |
|---------|-----------------|-------------------|
| Canvas View | Default view on launch | `Ctrl+0` |
| Add Project | Canvas toolbar | — |
| Focused View | Double-click project on canvas | — |
| New Task | Task Board → "+ New Task" | `Ctrl+N` |
| Terminal tab | Right panel → "Terminal" | `Ctrl+1` |
| Browser tab | Right panel → "Browser" | `Ctrl+2` |
| Diff tab | Right panel → "Diff" | `Ctrl+3` |
| Tool Log tab | Right panel → "Log" | — |
| Agent Summary tab | Right panel → "Summary" | — |
| Back to Canvas | Top-left "← Canvas" button | `Ctrl+0` |

---

## Concepts from the Source Material

BigIDE is a prototype implementing ideas from two sources:

**Addy Osmani — "Death of the IDE?"** (March 2026)
> The new loop: specify intent → delegate → observe → review diffs → merge.

This guide walked you through exactly this loop. You specified intent (the prompt), delegated (started the agent), observed (terminal + tool log + notifications), reviewed (diff + summary), and merged (merge button or PR creation).

**Theo Browne — "You Need a Bigger IDE"** (March 2026)
> Instead of shaping my editor around my project, I want to shape all my projects around one good editor.

The canvas view is this idea made concrete. One app holds all your projects. Each project's terminal, browser, agent tasks, and diffs are co-located — no more mental mapping between separate apps.
