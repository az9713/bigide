# BigIDE User Guide

Welcome to BigIDE — your mission control for AI coding agents.

---

## Table of Contents

- [Part 1: Getting Started](#part-1-getting-started)
  - [What is BigIDE?](#1-what-is-bigide)
  - [Installation](#2-installation)
  - [First Look — The Interface](#3-first-look--the-interface)
- [Part 2: Core Concepts](#part-2-core-concepts)
  - [Projects](#4-projects)
  - [Tasks](#5-tasks)
  - [Agents and Models](#6-agents-and-models)
  - [Worktrees](#7-worktrees)
  - [Governance](#8-governance)
- [Part 3: Quick Start — 10 Use Cases](#part-3-quick-start--10-use-cases)
  - [Use Case 1: Adding Your First Project](#use-case-1-adding-your-first-project)
  - [Use Case 2: Creating Your First Task](#use-case-2-creating-your-first-task)
  - [Use Case 3: Running a Task](#use-case-3-running-a-task)
  - [Use Case 4: Monitoring Agent Progress](#use-case-4-monitoring-agent-progress)
  - [Use Case 5: Handling Agent Input Requests](#use-case-5-handling-agent-input-requests)
  - [Use Case 6: Reviewing Code Changes](#use-case-6-reviewing-code-changes)
  - [Use Case 7: Merging Approved Changes](#use-case-7-merging-approved-changes)
  - [Use Case 8: Creating a Pull Request](#use-case-8-creating-a-pull-request)
  - [Use Case 9: Viewing a Session Report](#use-case-9-viewing-a-session-report)
  - [Use Case 10: Managing Governance Approvals](#use-case-10-managing-governance-approvals)
  - [Use Case 11: Working with Multiple Projects](#use-case-11-working-with-multiple-projects)
- [Part 4: Feature Reference](#part-4-feature-reference)
  - [Canvas View](#10-canvas-view)
  - [Task Board](#11-task-board)
  - [Terminal](#12-terminal)
  - [Diff Viewer](#13-diff-viewer)
  - [Tool Log](#14-tool-log)
  - [Summary Panel](#15-summary-panel)
  - [Browser Panel](#16-browser-panel)
  - [Notifications](#17-notifications)
- [Part 5: Tips and Troubleshooting](#part-5-tips-and-troubleshooting)
  - [Tips for Best Results](#18-tips-for-best-results)
  - [Troubleshooting](#19-troubleshooting)
  - [Keyboard Shortcuts](#20-keyboard-shortcuts)

---

## Part 1: Getting Started

### 1. What is BigIDE?

BigIDE is a desktop application that lets you manage AI coding assistants — called agents — working on your software projects.

Think of it as mission control. You sit at the center and direct multiple AI agents, each working on a different task in your codebase. While one agent is writing a new feature, another might be fixing a bug, and a third could be writing tests. BigIDE keeps everything organized, lets you watch what each agent is doing in real time, and gives you a clear review process before any code gets merged into your project.

You do not need to be a professional software engineer to use BigIDE. If you can describe what you want in plain English, an AI agent can write the code. BigIDE is the tool that connects your instructions to the agent and brings the results back to you.

Here is what BigIDE handles for you:

- Organizing your projects in one place
- Creating and assigning tasks to AI agents
- Isolating each task so agents do not interfere with each other
- Showing you exactly what code the agent changed
- Letting you approve or reject changes before they affect your project
- Creating GitHub pull requests when you are ready to share work

---

### 2. Installation

Before opening BigIDE, you need to install three tools it depends on. Follow these steps in order.

#### Step 1 — Install Node.js

Node.js is the engine that runs BigIDE.

1. Open your web browser and go to [https://nodejs.org](https://nodejs.org)
2. Click the button labeled "LTS" (this is the stable, recommended version)
3. Run the downloaded installer and follow the prompts — the default options are fine
4. When installation finishes, open a terminal (on Mac: search for "Terminal"; on Windows: search for "Command Prompt" or "PowerShell")
5. Type `node --version` and press Enter
6. You should see a version number like `v20.11.0` — this confirms Node.js is installed

#### Step 2 — Install Git

Git is the version control system that BigIDE uses to manage code changes.

1. Go to [https://git-scm.com](https://git-scm.com)
2. Download the installer for your operating system
3. Run the installer — the default options are fine for most users
4. Open a terminal, type `git --version`, and press Enter
5. You should see something like `git version 2.43.0`

#### Step 3 — Install an AI Coding Agent

BigIDE works with several AI agents. Gemini CLI (Google's Gemini Flash Lite) is the default and a good starting point.

To install Gemini CLI:
1. Make sure Node.js is installed (Step 1 above)
2. Open a terminal
3. Type the following command and press Enter:
   ```
   npm install -g @google/gemini-cli
   ```
4. Once installed, type `gemini --version` to confirm it worked

Alternatively, to install Claude Code:
1. Type the following command and press Enter:
   ```
   npm install -g @anthropic-ai/claude-code
   ```
2. Follow the prompts to sign in with your Anthropic account
3. Once installed, type `claude --version` to confirm it worked

#### Step 4 — Open BigIDE

1. Open a terminal
2. Navigate to the BigIDE folder. For example:
   ```
   cd /Users/yourname/Downloads/bigide
   ```
   (Replace the path with wherever you saved BigIDE)
3. Install BigIDE's dependencies by running:
   ```
   npm install
   ```
   This may take a minute or two the first time.
4. Start BigIDE:
   ```
   npm run dev
   ```
5. A window will open — that is BigIDE.

You only need to run `npm install` once. After that, you can start BigIDE with `npm run dev` each time.

---

### 3. First Look — The Interface

When BigIDE opens, you will see the main interface. Here is a map of what each area does.

#### Canvas View (Center)

This is the default view and the home base of BigIDE. It shows all of your projects as cards arranged on a large canvas — like sticky notes on a whiteboard. Each card represents one project and shows a summary of what is happening inside it.

When you first open BigIDE with no projects added, the canvas will be empty with a prompt to add your first project.

#### Sidebar (Left)

The sidebar lists all your projects by name. Clicking a project name in the sidebar jumps you directly to that project's Task Board. The sidebar also shows icons that represent different views within a project.

#### Notification Bell (Top Right)

The bell icon in the top-right corner alerts you to important events:
- An agent is waiting for your input
- A task has completed
- A task encountered an error
- An agent is requesting your approval before doing something sensitive

A red badge with a number appears on the bell when there are unread notifications. Click the bell to see the list.

#### Project View (Inside a Project)

When you open a project, the center of the screen switches to a panel layout with several tabs:

- **Board** — Kanban-style columns showing all tasks and their status
- **Terminal** — Live terminal output from running agents
- **Log** — A timeline of every action an agent has taken
- **Diff** — A side-by-side view of all code changes
- **Summary** — An auto-generated summary of completed work
- **Browser** — An embedded web browser for testing your app

---

## Part 2: Core Concepts

Before jumping into tutorials, it helps to understand the vocabulary BigIDE uses.

### 4. Projects

A project is a folder on your computer. BigIDE automatically handles Git setup for you:

- **Existing Git repo:** Detected and used as-is. The default branch is auto-detected.
- **Existing folder, not a Git repo:** BigIDE runs `git init`, creates a `README.md`, and makes an initial commit automatically.
- **New folder:** BigIDE creates the directory, initializes Git, and makes the initial commit.

You do not need to run `git init` yourself — just point BigIDE at any folder.

Each project in BigIDE acts as a container for tasks. You can have as many projects as you like, and they are each represented as a card on the canvas. Hover over a project card to reveal an **X** button in the top-right corner — click it to remove the project.

### 5. Tasks

A task is a unit of work you want an AI agent to do. Think of it like a ticket in a project management tool (similar to a JIRA or GitHub Issue). Each task has:

- A **title** — a short description, like "Add user login page"
- A **prompt** — the full instructions for the agent, written in plain English
- A **model** — the AI agent you want to do the work
- A **branch** — a separate copy of your code where the agent will work
- A **status** — where the task is in its lifecycle (Todo, Running, Needs Review, Done, Error)

Tasks move through these statuses as work progresses.

### 6. Agents and Models

An agent (also called a model) is the AI assistant that does the actual coding work. BigIDE supports several:

- **Gemini CLI** (by Google) — **default**; runs `gemini -i` in interactive mode, fast and lightweight
- **Claude Code** (by Anthropic) — strong at following complex instructions and reading large codebases
- **Codex** (by OpenAI)
- **Copilot** (by GitHub)
- **Custom** — bring your own agent command

The dropdown in the task creation form lists them in the order above, with Gemini CLI pre-selected. You can change the selection for any individual task. You select which agent to use when you create a task.

### 7. Worktrees

This is one of the most powerful features in BigIDE, and it works automatically in the background.

When an agent starts working on a task, BigIDE creates a "worktree" — an isolated copy of your code that exists on its own branch. This is like giving the agent its own parallel universe to work in. Changes the agent makes do not touch your main code until you explicitly approve and merge them.

This means:
- You can run five tasks at the same time without them interfering with each other
- If an agent makes a mistake, your main code is unaffected
- You can review and reject changes you do not like

You do not need to set up worktrees manually — BigIDE creates and manages them for you.

### 8. Governance

Governance refers to the safety controls built into BigIDE.

Some commands an agent might run are sensitive — things like pushing code to a remote server, deleting files, or running deployment scripts. BigIDE can intercept these actions and ask for your approval before allowing them to proceed.

When governance triggers, a modal appears in BigIDE showing you exactly what the agent wants to do. You can approve it to let the agent continue, or deny it to block the action. This gives you a safety net without requiring you to watch every terminal line.

---

## Part 3: Quick Start — 10 Use Cases

Each of the following sections walks you through a specific scenario from start to finish. If you are new to BigIDE, work through these in order.

---

### Use Case 1: Adding Your First Project

This tutorial assumes you have BigIDE running. You do **not** need an existing Git repository — BigIDE sets everything up automatically.

**Step 1 — Open the canvas**

BigIDE should start on the Canvas View. If you are inside a project, press Escape to return to the canvas.

**Step 2 — Click the "+" button**

Look for the "+ Add Project" button in the top toolbar. Click it to open the folder picker dialog.

**Step 3 — Select or create a project folder**

A file picker will open. You have two choices:

- **Select an existing folder** — any folder on your machine. It does not need to be a Git repository.
- **Create a new folder** — use the "New Folder" button in the dialog to create one (e.g., `test-bigide-project`), then select it.

**Step 4 — Done**

The project appears as a card on the canvas. The project name is automatically extracted from the folder name.

**What happened behind the scenes:**

BigIDE checked your selected folder:

- If it was already a Git repository, BigIDE detected the default branch (e.g., `main` or `master`) and saved the project.
- If it was **not** a Git repository, BigIDE automatically ran `git init`, created a `README.md` file, and committed it — making the folder ready for agent work.
- If the folder didn't exist, BigIDE created it first, then initialized Git.

**Managing projects:**

- **Double-click** a project card to open it.
- **Hover** over a project card to reveal the **X** button — click it to remove the project.
- **Drag** project cards to rearrange them on the canvas.

---

### Use Case 2: Creating Your First Task

Once you have a project on the canvas, you can create a task and assign it to an AI agent.

**Step 1 — Open the project**

Double-click the project card on the canvas to open the project view. You will see the Task Board with empty columns.

**Step 2 — Click "New Task"**

Look for a "New Task" button in the Task Board area and click it. A modal dialog will appear.

**Step 3 — Fill in the task details**

The form has several fields:

- **Title**: A short name for this task. Example: `Add a README file`
- **Prompt**: The full instructions for the agent. Be as specific as you can. Example: `Create a README.md file in the root of the project. It should include a title, a one-paragraph description of the project, installation instructions, and a usage section. Use Markdown formatting.`
- **Model**: Select the AI agent you want to use from the dropdown. The default is **Gemini CLI (Flash Lite)**. If you installed a different agent, you can select it here.
- **Branch name**: BigIDE will suggest a branch name based on your title (like `add-a-readme-file`). You can leave this as-is or customize it.

**Step 4 — Click Create**

Click the "Create" button. The dialog closes.

**Step 5 — Find your task**

The task now appears as a card in the "Todo" column of the Task Board. It is ready to be started whenever you want.

**Tips for writing good prompts:**

- Be specific about what files to create or modify
- Mention any constraints (e.g., "do not change the existing API endpoints")
- Describe the expected output (e.g., "the function should return a sorted array")
- Provide examples if helpful

---

### Use Case 3: Running a Task

Now that you have a task in the Todo column, you can start the AI agent working on it.

**Step 1 — Find the task**

Locate your task card in the "Todo" column of the Task Board.

**Step 2 — Click "Start"**

On the task card, click the "Start" button. BigIDE will:

1. Create a new Git worktree (an isolated copy of your code) on a new branch
2. Launch the AI agent inside that worktree
3. Pass your prompt to the agent as its instructions

**Step 3 — Watch the task move**

The task card moves from the "Todo" column to the "Running" column. This happens automatically as soon as the agent begins working.

**Step 4 — Open the Terminal tab**

Click the "Terminal" tab in the panel at the top of the project view. You will see a live terminal showing the agent's output as it works. This is the raw output — the agent's thinking, tool calls, and progress messages scroll by in real time.

You do not need to watch the terminal, but it is useful for understanding what the agent is doing and catching any issues early.

**Step 5 — Wait (and use "Mark Done" if needed)**

Depending on the complexity of the task, the agent might take anywhere from a few seconds to several minutes. For a simple task like "Add a README file," expect it to finish in under a minute.

When the agent finishes, BigIDE's output parser automatically detects completion and moves the task to "Needs Review." However, if the parser does not trigger (this can happen with agents that have unusual output), the task will stay in "Running." In that case, click the **"Mark Done"** button (yellow, next to "Stop") on the task card to manually advance it to "Needs Review."

---

### Use Case 4: Monitoring Agent Progress

The terminal is useful for raw output, but the Tool Log gives you a more structured view of what the agent is doing.

**Step 1 — Start a task**

Make sure you have a task in the "Running" state (follow Use Case 3 if needed).

**Step 2 — Click the "Log" tab**

Click on the "Log" tab in the project view panel.

**Step 3 — Read the timeline**

The Log panel shows a chronological timeline of every action the agent has taken. Each entry includes:

- The type of action (file edit, bash command, file read, etc.)
- A timestamp
- Details about what was affected (for example, which file was edited)

Common action types you will see:

- **file_read** — The agent read a file to understand the codebase
- **file_edit** — The agent made changes to a file
- **bash** — The agent ran a terminal command
- **governance** — An action was flagged for your review

**Step 4 — Filter the timeline**

At the top of the Log panel, there are filter buttons labeled with action types. Click a button to show only that type of action. For example, clicking "file_edit" will show you only the files the agent changed.

**Step 5 — Watch it update**

The Log panel auto-scrolls as new actions come in. You can scroll up to review earlier actions at any time.

---

### Use Case 5: Handling Agent Input Requests

Sometimes an agent gets to a point where it needs clarification or approval from you before it can continue. This is normal and expected.

**Step 1 — Spot the badge**

When an agent is waiting for input, the task card in the Task Board will show an "INPUT" badge — usually in orange or yellow. The notification bell at the top right will also show an alert.

**Step 2 — Open the Terminal tab**

Click on the Terminal tab for the project. The agent's terminal will be visible, and you should see a prompt or question from the agent near the bottom of the output.

**Step 3 — Read the agent's message**

The agent will have written something like:
```
I found two configuration files with conflicting settings. Which should I use?
1. config.development.json
2. config.production.json
Please enter 1 or 2:
```

**Step 4 — Type your response**

Click anywhere in the terminal panel to focus it, then type your answer and press Enter. In the example above, you would type `1` or `2`.

**Step 5 — The agent continues**

After receiving your input, the agent will continue working. The "INPUT" badge on the task card will disappear.

---

### Use Case 6: Reviewing Code Changes

When an agent finishes its work, the task moves to "Needs Review." This is your chance to inspect exactly what was changed before accepting it into your project.

**Step 1 — Find the completed task**

Look in the "Needs Review" column of the Task Board. Completed tasks land here automatically.

**Step 2 — Click "View Diff"**

On the task card, click the "View Diff" button. The Diff panel opens.

**Step 3 — Read the changes**

The Diff panel shows all the code changes the agent made, file by file. The format uses standard diff colors:

- **Green lines** (with a `+` symbol) are new lines the agent added
- **Red lines** (with a `-` symbol) are lines the agent deleted or replaced
- **White/gray lines** are unchanged context lines, shown for reference

At the top of the Diff panel, a stats bar shows a summary: how many files were changed, how many lines were added, and how many were deleted.

**Step 4 — Navigate between files**

If the agent changed multiple files, you can scroll through the diff to see each one. Each file's changes are shown in its own section with the filename as a header.

**Step 5 — Decide what to do**

After reviewing:
- If the changes look good, proceed to merge (Use Case 7) or create a PR (Use Case 8)
- If you want changes but something is wrong, you can create a new task asking the agent to fix it, or edit the files manually in your editor
- If you want to discard the changes entirely, use the "Cleanup" option to delete the worktree without merging

---

### Use Case 7: Merging Approved Changes

Once you are satisfied with what the agent built, you can merge the changes directly into your main branch.

**Step 1 — Review the diff first**

Always review the diff (Use Case 6) before merging. Once changes are merged, reverting them requires using Git directly.

**Step 2 — Click "Merge" on the task card**

In the "Needs Review" column, find your task card and click the "Merge" button.

BigIDE will:
1. Merge the agent's branch into your main branch
2. Move the task to the "Done" column

If anything goes wrong during the merge (permissions issue, conflict, etc.), an error message will appear inline on the task card describing what failed.

**Step 3 — Clean up the worktree**

After merging, the worktree (isolated copy of the code) is no longer needed. Click "Cleanup" on the task card to remove it. This frees up disk space and keeps things tidy.

The task remains in the "Done" column as a record of the work, but the temporary branch and worktree are gone.

**Note:** If there are merge conflicts — meaning the agent's changes overlap with other changes made to your main branch — BigIDE will notify you. In that case, you will need to resolve the conflicts manually in your code editor. See the Troubleshooting section for guidance.

---

### Use Case 8: Creating a Pull Request

If you are collaborating with others or want to follow a code review process, you can create a GitHub Pull Request (PR) instead of merging directly.

**Step 1 — Make sure your project is connected to GitHub**

Your project's Git remote should point to a GitHub repository. You can check this by running `git remote -v` in your project folder. You should see a URL containing `github.com`.

**Step 2 — Click "Create PR" on the task card**

In the "Needs Review" column, find your task card and click the "Create PR" button.

BigIDE will:
1. Push the agent's branch to your GitHub repository
2. Create a Pull Request on GitHub
3. Populate the PR description with the agent's summary of changes

**Step 3 — Review the PR link**

After the PR is created, a link appears on the task card. Click it to open the PR in your web browser, where you can review it, request reviews from teammates, and eventually merge it through GitHub.

**Step 4 — The task status**

The task moves to a "Done" state in BigIDE after the PR is created. The worktree is retained until you clean it up, which you can do via the "Cleanup" button.

---

### Use Case 9: Viewing a Session Report

After a task completes, BigIDE can produce a self-contained HTML receipt of everything the agent did. This is useful for auditing, sharing with a teammate, or just archiving what happened.

**Step 1 — Find a completed task**

Look for a task in the "Needs Review", "Done", or "Error" column. The session report is available on any of these.

**Step 2 — Click "Report"**

On the task card, click the cyan **"Report"** button. BigIDE will generate (or regenerate) the HTML file and open it immediately in your default web browser.

**Step 3 — Read the report**

The report is a single self-contained HTML page containing:

- Task title, model, status, and branch name
- Timestamps for when the task started and finished, and the total duration
- The original prompt you provided
- PR URL if a pull request was created
- Diff statistics and a full color-coded diff (green additions, red deletions)
- The agent's summary of what was done
- A timeline of every agent action (file edits, bash commands, etc.)
- Any governance decisions that were made
- The full terminal transcript, cleaned of ANSI escape codes

**Step 4 — Find the file on disk**

Reports are saved to `.bigide-reports/` inside your project directory. The filename includes the task title and a timestamp, so multiple runs of the same task each get their own report. You can commit these files, email them, or archive them as a permanent record.

> Clicking "Report" always regenerates the file from the current task state, so the report stays accurate even if you later mark a task done or merge it.

---

### Use Case 10: Managing Governance Approvals

Governance is BigIDE's safety system. When an agent attempts a potentially risky action, BigIDE pauses and asks for your approval.

**Step 1 — The approval modal appears**

While an agent is running, a yellow modal dialog may appear in BigIDE. This means the agent wants to perform an action that requires your approval. Common triggers include:

- Running `git push` (pushing code to a remote server)
- Running commands with `rm -rf` (deleting files)
- Running deployment scripts
- Making network requests to external services

**Step 2 — Read the modal carefully**

The modal shows you:
- What command or action the agent wants to take
- Why the action was flagged
- The exact text of the command

Take a moment to read this before deciding. Ask yourself: "Do I expect the agent to be doing this right now, given the task I assigned?"

**Step 3 — Approve or Deny**

- Click **Approve** to allow the action. The agent will continue executing the command.
- Click **Deny** to block the action. BigIDE sends a stop signal (Ctrl+C) to the agent, which cancels the command. The agent may then try an alternative approach, or stop and report back to you.

**Step 4 — After denial**

If you deny an action, check the Terminal tab to see how the agent responds. It may ask for your guidance on what to do instead, or it may complete the task without that particular step. If the agent seems stuck, you can use the Terminal to type instructions directly.

---

### Use Case 11: Working with Multiple Projects

One of BigIDE's core strengths is managing several projects at once. This use case shows you how to get the most out of the canvas when you are juggling multiple workstreams.

**Step 1 — Add multiple projects**

Follow Use Case 1 to add each of your projects to BigIDE. After adding several, you will see multiple project cards on the canvas.

**Step 2 — Arrange the canvas**

You can drag project cards around the canvas to organize them however makes sense to you. For example, you might group frontend and backend projects together, or arrange them by priority.

**Step 3 — Start tasks on different projects**

Open each project by double-clicking its card, create and start tasks, then press Escape to return to the canvas. Each project can have agents running simultaneously — they work in parallel, each in their own isolated worktrees.

**Step 4 — Watch the status dots**

From the canvas view, each project card shows small colored dots representing the status of tasks inside. At a glance you can see which projects have tasks running (spinning or blue), which need your review (yellow), and which have errors (red).

**Step 5 — Use the notification bell**

As tasks complete or require your attention across different projects, alerts appear in the notification bell. Click the bell to see all pending notifications. Click any notification to jump directly to the relevant project.

**Step 6 — Navigate with the MiniMap**

If you have many projects and the canvas is large, look for the MiniMap in the corner of the canvas view. This small thumbnail shows you the full layout of your canvas and your current view position. Click and drag the MiniMap to navigate quickly.

**Step 7 — Return to the canvas**

No matter where you are in BigIDE, pressing Escape brings you back to the canvas view. This is your home base.

---

## Part 4: Feature Reference

This section describes each feature in detail, useful as a reference once you are comfortable with the basics.

### 10. Canvas View

The canvas is the top-level view of all your projects.

**Drag to arrange** — Click and drag any project card to reposition it on the canvas. Your layout is saved automatically.

**Task status dots** — Each project card displays colored dots indicating the current state of tasks inside:
- Blue / spinning — Tasks are running
- Yellow — Tasks are waiting for review or input
- Green — Tasks are done
- Red — Tasks have errors

**MiniMap** — A small thumbnail in the corner of the canvas shows the full layout. Use it to navigate when you have many projects spread across a large area.

**Double-click to focus** — Double-clicking a project card opens that project's full view.

**Ctrl+N (or Cmd+N on Mac)** — Keyboard shortcut to open the "Add Project" dialog from the canvas.

---

### 11. Task Board

The Task Board is the Kanban view inside a project. It has five columns:

| Column | Meaning |
|---|---|
| Todo | Task is created but not started |
| Running | Agent is actively working on the task |
| Needs Review | Agent finished; you need to review the diff |
| Done | Changes merged or PR created |
| Error | Something went wrong; check the terminal |

**Task cards** show:
- Task title
- Current status badge
- Which AI model is assigned
- The branch name
- A snippet of the last output from the agent
- Action buttons appropriate to the current status
- Inline error messages when an action (Start, Merge, Create PR, Cleanup) fails
- PR URL after a pull request is successfully created

**Action buttons by status:**

- Todo: Start, Delete
- Running: Stop, **Mark Done** (yellow — manually advances to "Needs Review" when auto-detection doesn't trigger)
- Needs Review: View Diff, Merge, Create PR, Discard, **Report** (cyan)
- Done: View Diff, Cleanup, **Report** (cyan)
- Error: View Log, Retry, **Discard**, Cleanup, **Report** (cyan)

> Buttons are automatically disabled during async operations to prevent accidental double-clicks.

**Session Reports**

When a task transitions to "Needs Review" or "Done", BigIDE automatically generates a self-contained HTML report and saves it to `.bigide-reports/` in the project directory. Clicking the cyan **"Report"** button on any eligible task card opens this report in the default browser (generating or regenerating it first).

Reports contain: task metadata, start/completion timestamps, the original prompt, PR URL, full color-coded diff, agent summary, tool log timeline, governance decisions, and a cleaned terminal transcript.

---

### 12. Terminal

The Terminal panel gives you a full, live terminal session for each running task.

**Multiple tabs** — If you have multiple tasks running, each gets its own terminal tab. Switch between them by clicking the tab labels.

**Full terminal emulation** — Colors, cursor movement, and special characters all work correctly. The output looks the same as it would if you ran the agent directly in your own terminal.

**Interactive input** — You can type directly into the terminal. This is how you respond to agent input requests (Use Case 5) or issue manual commands if needed.

**Scrollback history** — The terminal keeps the last 5,000 lines of output. Scroll up to review earlier output that has scrolled off screen.

---

### 13. Diff Viewer

The Diff panel shows a complete picture of all code changes the agent made.

**Unified diff format** — This is the standard format used by Git. Each changed file is shown in sequence, with added lines in green and deleted lines in red.

**File navigation** — Scroll through the diff to move from file to file. Each file section is clearly labeled with the file path.

**Stats bar** — At the top of the Diff panel, a summary line shows:
- Number of files changed
- Total lines added
- Total lines deleted

**Supported change types:**
- File modification — Changes to an existing file
- File creation — A new file the agent created
- File deletion — A file the agent removed
- File rename — A file that was moved or renamed

---

### 14. Tool Log

The Tool Log gives you a structured, readable timeline of everything an agent did during a task.

**Timeline format** — Each entry shows the action type, timestamp, and relevant details. Entries are ordered from oldest to newest, with the latest at the bottom.

**Filter buttons** — Use the filter buttons at the top of the Log panel to show only specific action types:
- `file_edit` — Show only file edits
- `bash` — Show only bash/terminal commands
- `file_read` — Show only file reads
- `governance` — Show only governance events (actions that were approved or denied)
- `other` — Show everything else

**Files affected** — For file edits, the log entry shows the path of the file that was changed.

**Auto-scroll** — The Log panel automatically scrolls to the latest entry as the agent works. Scroll up at any time to review the history.

---

### 15. Summary Panel

When a task completes, the Summary panel shows an auto-generated overview of what was accomplished.

**Contents of the summary:**
- A description of the work done (written by the agent)
- A list of files created, modified, and deleted
- Statistics: total lines inserted and deleted
- Your original prompt, for reference

The Summary panel is useful for quickly understanding what an agent did without reading through the full diff or terminal output.

---

### 16. Browser Panel

The Browser panel is a web browser built directly into BigIDE.

**URL bar** — Type any URL to navigate to it, or enter a local address like `http://localhost:3000` to view an app running on your machine.

**Navigation controls** — Back, forward, and reload buttons work the same as any browser.

**Use cases:**
- Viewing a web app the agent is building while it works
- Testing changes in the browser without switching applications
- Checking that a deployed page looks correct

---

### 17. Notifications

The notification system keeps you informed across all projects without requiring you to watch each one.

**Bell icon** — Located in the top-right corner. A red badge shows the number of unread notifications.

**Notification types:**

| Type | Meaning |
|---|---|
| needs-input | An agent is paused and waiting for your response |
| completed | A task finished successfully and is ready for review |
| error | A task encountered a problem and stopped |
| approval-needed | An agent wants to perform a sensitive action |

**Click to navigate** — Clicking a notification in the list jumps you directly to the project and task that generated it, so you do not have to find it manually.

**Dismissing notifications** — Once you have addressed a notification (responded to the agent, reviewed the diff, etc.), it clears from the unread list.

---

## Part 5: Tips and Troubleshooting

### 18. Tips for Best Results

**Write clear, specific prompts**

The quality of an agent's work is directly tied to the quality of your instructions. Vague prompts like "make the app better" will produce unpredictable results. Specific prompts like "add input validation to the login form so that the email field must contain an @ symbol and the password must be at least 8 characters, and show an inline error message below each field when validation fails" give the agent clear guidance.

**Start with small tasks**

If you are new to working with AI agents, start with tasks that have a clear, limited scope. "Add a README file" or "Fix the typo in the homepage heading" are good first tasks. Once you are comfortable with the review and merge workflow, you can tackle larger tasks with confidence.

**Always review diffs before merging**

Never merge without looking at the diff first. Even well-behaved agents occasionally make unexpected changes. The diff review step is your safety net — use it every time.

**Use governance for sensitive projects**

If you are working on a production codebase or a project with sensitive data, take time to understand the governance settings. Making sure that destructive commands and network operations require your approval adds an important layer of protection.

**Break large tasks into smaller ones**

If you have a large feature to build, consider breaking it into several smaller tasks. Smaller tasks are easier for agents to complete correctly, easier for you to review, and easier to roll back if something goes wrong.

**Keep your prompts in the prompt field, not the title**

The title is just a label — use it for something short and human-readable. Put all your instructions and requirements in the prompt field where the agent can read them in full.

**Iterate with follow-up tasks**

If an agent's output is close but not perfect, do not worry. Create a follow-up task describing what needs to be fixed. Agents handle iterative refinement well.

---

### 19. Troubleshooting

**The app will not start**

If running `npm run dev` produces an error or nothing happens:
1. Make sure Node.js is installed: run `node --version` in your terminal
2. Make sure you ran `npm install` in the BigIDE folder before running `npm run dev`
3. Check that you are running the command from inside the BigIDE folder
4. Look for error messages in the terminal output — they usually describe the problem clearly

**The agent is not found / task fails immediately**

If a task moves to the Error column right away, the most common cause is that the agent CLI is not installed or not in your system's PATH.
1. Open a terminal and type the agent's command (e.g., `claude --version`) to confirm it is installed
2. If the command is not found, reinstall the agent following the instructions in the Installation section
3. After reinstalling, restart BigIDE and try again

**A task is stuck in Running**

If a task has been in the Running state for much longer than expected:
1. Open the Terminal tab to see the agent's last output — it may be waiting for input (look for a prompt or question at the bottom of the terminal)
2. If the agent has actually finished but the task still shows "Running," click **"Mark Done"** (the yellow button) on the task card — this manually advances the task to "Needs Review" so you can review and merge the changes
3. If the agent appears genuinely stuck or looping, click "Stop" on the task card, review the terminal output to understand what happened, then create a new task with a more specific prompt or additional constraints

**Merge conflicts**

If BigIDE reports a merge conflict when you try to merge a task:
1. The agent's changes overlap with other changes that were made to your main branch after the task started
2. You will need to resolve the conflict manually:
   - Open your code editor
   - Navigate to the files with conflicts (they will contain conflict markers like `<<<<<<`, `=======`, and `>>>>>>>`)
   - Edit the files to resolve the conflicts
   - Save the files
   - Run `git add .` and `git merge --continue` in your terminal
3. After resolving conflicts, use the "Cleanup" button in BigIDE to remove the worktree

**White screen or blank window**

If BigIDE opens but shows nothing:
1. Press Ctrl+Shift+I (or Cmd+Option+I on Mac) to open the developer tools
2. Click the "Console" tab in the developer tools panel
3. Look for red error messages — these describe what went wrong
4. Take note of the error and check if it matches a known issue in the project's documentation
5. Restarting BigIDE with `npm run dev` resolves most transient issues

**Changes were merged but I want to undo them**

BigIDE does not have an undo button for merges, but Git does. In your terminal:
1. Run `git log --oneline -5` to see recent commits
2. Find the commit that represents the merge
3. Run `git revert <commit-hash>` to create a new commit that undoes those changes

This is safe because it does not rewrite history — it just adds a new commit that reverses the changes.

---

### 20. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Escape | Return to canvas view from any project view |
| Ctrl+N (Windows/Linux) | Add a new project (from canvas view) |
| Cmd+N (Mac) | Add a new project (from canvas view) |

More shortcuts may be available depending on which panel is active. Look for underlined letters or shortcut hints in the interface.

---

*BigIDE User Guide — Last updated March 2026*
