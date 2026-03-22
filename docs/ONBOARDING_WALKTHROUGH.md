# BigIDE Onboarding Walkthrough

A complete guide to getting started with BigIDE — from installation to running your first AI-powered coding task.

---

## Table of Contents

1. [What is BigIDE?](#what-is-bigide)
2. [Prerequisites Checklist](#prerequisites-checklist)
3. [Step A: Install Dependencies and Launch](#step-a-install-dependencies-and-launch)
4. [Step B: The Canvas View (Home Screen)](#step-b-the-canvas-view-home-screen)
5. [Step C: Enter Project View](#step-c-enter-project-view)
6. [Step D: Create Your First Task](#step-d-create-your-first-task)
7. [Step E: Start the Task](#step-e-start-the-task)
8. [Step F: Monitor Progress](#step-f-monitor-progress)
9. [Step G: Handle Input Requests](#step-g-handle-input-requests)
10. [Step H: Review the Changes](#step-h-review-the-changes)
11. [Step H.5: View the Session Report](#step-h5-view-the-session-report)
12. [Step I: Merge or Create a Pull Request](#step-i-merge-or-create-a-pull-request)
13. [Step J: Cleanup](#step-j-cleanup)
14. [Step K: Test Governance Controls](#step-k-test-governance-controls)
15. [Step L: Multi-Project Workflow](#step-l-multi-project-workflow)
16. [Quick Test Prompts](#quick-test-prompts)
17. [Troubleshooting](#troubleshooting)
18. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## What is BigIDE?

BigIDE is a desktop application that acts as **mission control for AI coding agents**. The core workflow is straightforward:

1. Point BigIDE at your Git repositories
2. Describe coding tasks in natural language prompts
3. AI agents (Gemini CLI, Claude Code, Codex, GitHub Copilot) perform the work in isolated Git branches
4. Review the generated diffs, then merge directly or open a Pull Request on GitHub

Each task runs in its own Git worktree, so your main branch is never touched until you explicitly approve and merge the changes.

---

## Prerequisites Checklist

Before launching BigIDE, verify that each of the following is installed and working on your machine.

### 1. Node.js (v18 or higher)

```bash
node --version   # Should show v18+ or v20+
```

If Node.js is not installed, download the LTS release from [https://nodejs.org](https://nodejs.org).

### 2. Git

```bash
git --version
```

If Git is not installed, download it from [https://git-scm.com](https://git-scm.com).

### 3. Python 3.x and C++ Build Tools

These are required to compile `node-pty`, a native C++ module that creates real terminal processes inside the app.

```bash
python --version   # Should show Python 3.x
```

**Windows users:** You also need the Visual Studio Build Tools with the **"Desktop development with C++"** workload enabled. Download from [https://visualstudio.microsoft.com/visual-cpp-build-tools/](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

> If `node-pty` fails to build during `npm install`, missing C++ build tools are almost always the cause.

### 4. At least one AI agent CLI

BigIDE dispatches tasks to whichever agent CLI is available on your system. Install at least one:

| Agent in BigIDE | CLI command invoked | Installation |
|---|---|---|
| `gemini-cli` **(default)** | `gemini -i "prompt"` | `npm install -g @google/gemini-cli` |
| `claude-code` | `claude "prompt"` | `npm install -g @anthropic-ai/claude-code` |
| `codex` | `codex "prompt"` | `npm install -g @openai/codex` |
| `copilot` | `gh copilot suggest "prompt"` | `gh extension install github/gh-copilot` |

After installing, verify the agent is accessible from your terminal:

```bash
gemini --version
# or
claude --version
# or
codex --version
```

### 5. GitHub CLI (optional)

Required only if you plan to use the **Create Pull Request** feature.

```bash
gh auth status   # Verify authentication status
```

If not authenticated, run `gh auth login` and follow the prompts.

---

## Step A: Install Dependencies and Launch

Navigate to the BigIDE project directory and install all dependencies:

```bash
cd path/to/bigide
npm install
```

This downloads approximately 200 packages and compiles the native `node-pty` module. The process may take several minutes on first run. If the build fails, revisit the [C++ Build Tools requirement](#3-python-3x-and-c-build-tools) above.

Once installation completes, launch the application:

```bash
npm run dev
```

You should see Vite build output in the terminal, followed by an Electron window opening. That window is BigIDE.

---

## Step B: The Canvas View (Home Screen)

When the app opens, you land on the **Canvas View** — a blank visual workspace where your projects appear as draggable cards connected in a graph layout.

**Adding your first project:**

1. Click the **"+"** button to add a project. A native folder picker dialog will open.
2. Select **any folder** on your machine — it does not need to be an existing Git repository. BigIDE handles setup automatically:
   - **Existing Git repo:** Detected and used as-is. The default branch is auto-detected (works with `main`, `master`, or any branch name).
   - **Existing folder, not a Git repo:** BigIDE runs `git init`, creates a `README.md`, and makes an initial commit — all automatically.
   - **New folder (created via the dialog):** BigIDE creates the directory, initializes Git, and makes the initial commit.
3. The project appears as a card on the canvas. The name is extracted from the folder name automatically.

> You do not need to run any `git init` commands yourself. BigIDE is an agentic IDE — just point it at a folder and it handles the rest.

**Managing projects on the canvas:**

- **Double-click** a project card to enter focused Project View.
- **Hover** over a project card to reveal the **X** button in the top-right corner — click it to remove the project.
- **Drag** project cards to rearrange them on the canvas. Positions are saved automatically.

---

## Step C: Enter Project View

Double-click any project card on the canvas to enter **Project View**.

The layout splits into two areas:

- **Left side:** Task Board — a Kanban board with columns: Todo, Running, Needs Review, Done, Error
- **Right side:** Tabbed panels — Terminal, Browser, Diff, Log, Summary

---

## Step D: Create Your First Task

1. Click the **"New Task"** button on the Task Board.
2. A creation modal appears. Fill in the fields:

   | Field | Example value |
   |---|---|
   | **Title** | `Add a hello world script` |
   | **Prompt** | `Create a file called hello.py that prints "Hello from BigIDE!" and add a comment explaining what it does` |
   | **Model** | `gemini-cli` (Gemini Flash Lite — default) |
   | **Branch Name** | Auto-generated, e.g., `bigide/add-hello-world-script` |
   | **Permissions** | Leave defaults: file write on, bash on, network off, git push off |

3. Click **Create**.
4. The task appears in the **"Todo"** column.

**What happened behind the scenes:**

BigIDE ran the following Git command:

```bash
git worktree add -b bigide/add-hello-world-script <path>
```

This creates an isolated copy of your repository at `../.bigide-worktrees/bigide/add-hello-world-script`. The AI agent will work exclusively in this copy — your main branch is never touched.

---

## Step E: Start the Task

1. Click the **"Start"** button on the task card.
2. The task moves to the **"Running"** column.
3. Click the **"Terminal"** tab in the right panel.

**What you will see in the terminal:**

- A shell opens inside the worktree directory.
- After roughly one second, BigIDE types the command: `gemini -i "Create a file called hello.py..."` (interactive mode)
- The agent launches and begins working.
- Agent output streams to the terminal in real-time.

**What is happening under the hood:**

- `node-pty` spawns a real terminal process attached to the worktree shell.
- BigIDE's output parser reads the terminal output every 500ms.
- Regex patterns detect tool calls, task completion, errors, and governance-sensitive commands.
- Status updates are pushed to the UI as they are detected.

**If the task stays "Running" after the agent finishes:**

The output parser uses heuristic regex patterns to detect agent completion. If the agent's final output does not match any known completion pattern, the task will remain in "Running" state. In this case, click the **"Mark Done"** button (yellow, next to "Stop") on the running task card. This manually transitions the task to "Needs Review" so you can proceed to review and merge the changes.

---

## Step F: Monitor Progress

While the agent works, the right-side panel provides two views:

- **Terminal tab:** Raw terminal output streaming from the agent. You can type here directly if needed.
- **Log tab:** A structured, filterable timeline of agent actions — file edits, bash commands, file reads, and searches. Use the type filter to focus on specific action categories.

---

## Step G: Handle Input Requests

Some agents pause to ask a clarifying question during a task. When this happens:

1. The task card displays an **"INPUT"** badge.
2. A notification appears in the bell icon in the top-right corner.
3. Click the **Terminal** tab.
4. Type your response and press **Enter**.
5. The agent resumes automatically.

---

## Step H: Review the Changes

When the agent finishes, the task status changes to **"Needs Review"**.

1. Click **"View Diff"** on the task card, or select the **Diff** tab directly.
2. The unified diff view shows all changes made by the agent:
   - **Green lines** — code the agent added
   - **Red lines** — code the agent removed
   - A stats bar at the top shows: files changed, insertions, and deletions
3. Switch to the **Summary** tab for a structured, human-readable summary of what was done and why.

Review the changes carefully before deciding how to proceed.

---

## Step H.5: View the Session Report

When a task moves to "Needs Review" or "Done", BigIDE automatically generates a self-contained HTML session report and saves it to `.bigide-reports/` inside your project directory.

To open the report:

1. Find the task card in the "Needs Review", "Done", or "Error" column.
2. Click the cyan **"Report"** button on the card.
3. BigIDE generates (or regenerates) the report and opens it in your default browser.

**What the report contains:**

- Task metadata: title, model, status, branch name
- Timestamps: when the task started, completed, and total duration
- The original prompt
- PR URL (if one was created)
- Diff stats and full color-coded diff (green additions, red deletions)
- Agent summary
- Tool log timeline (every agent action with timestamps)
- Governance decisions
- Full terminal transcript (cleaned of ANSI codes)

> Reports are regenerated each time you click the "Report" button, so they always reflect the latest state of the task. The `.bigide-reports/` folder can be committed, shared, or archived as a permanent record of agent work.

---

## Step I: Merge or Create a Pull Request

> **If the task is still showing as "Running" after the agent has finished:** the output parser did not automatically detect completion. Click **"Mark Done"** (the yellow button next to "Stop") on the task card to manually advance it to "Needs Review". The review buttons (View Diff, Merge, Create PR, Discard) will then appear.

After reviewing the diff, choose one of four actions:

**Option 1: Merge directly**

Click **"Merge"**. BigIDE runs `git merge` in your main repository and automatically moves the task to "Done". Use this for low-risk changes or private projects.

**Option 2: Create a Pull Request**

Requires a GitHub-hosted repository and authentication.

- Your project must have `githubRepo` set in the format `owner/repo`.
- Authentication requires either a `GITHUB_TOKEN` environment variable or an active `gh auth login` session.

Click **"Create PR"**. BigIDE pushes the branch to GitHub, creates the pull request with the agent's summary as the PR body, and displays the PR URL on the task card.

**Option 3: Discard the changes**

Click **"Discard"** to reject the agent's work. The worktree is removed, the PTY is cleaned up, and the task is removed from the board. Nothing is merged.

**Option 4: Keep reviewing**

You can leave the task in "Needs Review" and come back to it later. The terminal history is preserved so you can scroll back through what the agent did.

---

## Step J: Cleanup

After merging a task, you can clean up its resources:

1. The task is now in the **"Done"** column (the merge button automatically updates the status).
2. Click **"Cleanup"** on the task card.
3. BigIDE removes the Git worktree from disk, terminates the associated PTY process, and permanently removes the task from the board and persistent storage.

> Tasks are fully removed on cleanup — they will not reappear when you restart the app or switch views.

---

## Step K: Test Governance Controls

BigIDE includes a governance layer that intercepts potentially dangerous commands before the agent can execute them.

To test this, create a task with a prompt that would naturally involve a restricted command — for example, one that involves deleting files or pushing to a remote.

When a governed command is detected:

1. A yellow approval modal appears in the UI.
2. The modal shows exactly what the agent is attempting to do.
3. Click **"Approve"** to allow the command, or **"Deny"** to send `Ctrl+C` and cancel it.

**Default blocked patterns:**

- `git push`
- `rm -rf`
- `npm publish`
- `deploy`

These patterns can be configured based on your project's requirements.

---

## Step L: Multi-Project Workflow

BigIDE is designed to manage multiple projects and concurrent tasks simultaneously.

1. Press **Escape** from any Project View to return to the Canvas View.
2. Add additional projects using the **"+"** button.
3. Start tasks across different projects — each runs in its own isolated worktree and PTY process.
4. The notification bell in the top-right corner aggregates activity across all projects, so nothing falls through the cracks.

---

## Quick Test Prompts

Use these prompts to verify different parts of the system are working correctly:

| # | Prompt | What it tests |
|---|--------|---------------|
| 1 | `Create a hello.py that prints hello world` | Basic file creation |
| 2 | `Add a .gitignore file for a Python project` | Simple file generation |
| 3 | `Create a README.md explaining this project` | Content generation |
| 4 | `Refactor the code in hello.py to use a main function` | Code modification |
| 5 | `Run the tests and fix any failures` | Bash execution combined with editing |

---

## Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| App won't start | Missing or broken dependencies | Run `npm install` again from the project root |
| `node-pty` build fails | Missing C++ build tools | Install VS Build Tools with the "Desktop development with C++" workload |
| Agent not found | CLI binary not in PATH | Run `claude --version` (or equivalent) in a standalone terminal to verify |
| Task creation fails | Branch already exists or folder is not writable | Use a unique branch name. BigIDE now shows the exact git error message. |
| Task stuck in "Running" after agent finishes | Output parser did not detect completion | Click **"Mark Done"** (yellow button) on the running task card to manually advance it to "Needs Review" |
| White screen on launch | JavaScript error in renderer | Open DevTools with `Ctrl+Shift+I` and check the Console tab for errors |
| "No GitHub token" when creating PR | Not authenticated with GitHub | Run `gh auth login` or set the `GITHUB_TOKEN` environment variable |
| Merge conflicts after agent work | Agent changes conflict with local commits | Resolve the conflict manually in your editor, then run Cleanup on the task |
| Old projects from previous runs | Stale data in persistent storage | Hover over project cards and click the X button to remove them, or delete `%APPDATA%/bigide/bigide-state.json` |
| Project added but name shows full path | Legacy issue (now fixed) | Remove and re-add the project. Names are now correctly extracted from folder names on all platforms. |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Return to Canvas View from any Project View |
| `Ctrl` / `Cmd` + `N` | Add a new project (from Canvas View) |

---

*For further information, see the source code and inline documentation in the `src/` directory.*
